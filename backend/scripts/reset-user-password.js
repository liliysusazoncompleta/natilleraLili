import "dotenv/config";
import bcrypt from "bcryptjs";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { validatePassword } from "../src/password.js";

const prisma = new PrismaClient();

async function ask(question) {
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    return (await prompt.question(question)).trim();
  } finally {
    prompt.close();
  }
}

function askSecret(question) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Ejecute este comando en una terminal interactiva para ocultar la contraseña.");
  }

  stdout.write(question);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003" || character === "\u0004") {
          cleanup();
          reject(new Error("Operación cancelada."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = Array.from(value).slice(0, -1).join("");
        } else if (character >= " ") {
          value += character;
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  const email = await ask("Correo exacto de la cuenta que desea restablecer: ");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt || user.status !== "ACTIVO") {
    throw new Error("No se encontró una cuenta activa con ese correo.");
  }

  stdout.write("Cuenta seleccionada: " + user.email + " (" + user.role + ")\n");
  if (await ask('Para confirmar, escriba "RESTABLECER": ') !== "RESTABLECER") {
    throw new Error("Operación cancelada.");
  }

  const password = await askSecret("Nueva contraseña (entrada oculta): ");
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);
  const confirmation = await askSecret("Repita la nueva contraseña: ");
  if (password !== confirmation) throw new Error("Las contraseñas no coinciden.");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id: user.id, status: "ACTIVO", deletedAt: null },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null }
    });
    if (result.count !== 1) throw new Error("La cuenta cambió durante la operación; no se actualizó.");
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  });

  stdout.write("Contraseña restablecida. Los tokens anteriores fueron revocados; inicie sesión con la nueva contraseña.\n");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
