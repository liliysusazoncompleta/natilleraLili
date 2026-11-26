import "dotenv/config";
import bcrypt from "bcryptjs";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { PrismaClient, Role } from "@prisma/client";
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
  if (process.env.NODE_ENV !== "production") {
    throw new Error("Este comando solo permite aprovisionar el administrador inicial en producción.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  const firstName = await ask("Nombres del administrador: ");
  const lastName = await ask("Apellidos del administrador: ");
  const email = (await ask("Correo del administrador: ")).toLowerCase();
  const username = await ask("Nombre de usuario para iniciar sesión: ");

  if (!firstName || !lastName || !username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Ingrese nombres, apellidos, un correo válido y un nombre de usuario.");
  }

  stdout.write(`Se creará el administrador ${firstName} ${lastName} (${username}, ${email}).\n`);
  if (await ask('Para confirmar, escriba "CREAR ADMINISTRADOR": ') !== "CREAR ADMINISTRADOR") {
    throw new Error("Operación cancelada.");
  }

  const password = await askSecret("Contraseña (entrada oculta; mínimo 8 caracteres): ");
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);
  const confirmation = await askSecret("Repita la contraseña: ");
  if (password !== confirmation) throw new Error("Las contraseñas no coinciden.");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(2026112601)`;
    const administrators = await tx.user.count({ where: { role: Role.ADMINISTRADOR } });
    if (administrators > 0) {
      throw new Error("Ya existe una cuenta administradora; no se creó ningún usuario.");
    }

    return tx.user.create({
      data: { email, username, firstName, lastName, passwordHash, role: Role.ADMINISTRADOR }
    });
  }, { isolationLevel: "Serializable" });

  stdout.write(`Administrador creado correctamente: ${user.email} (${user.username}). Ya puede iniciar sesión.\n`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
