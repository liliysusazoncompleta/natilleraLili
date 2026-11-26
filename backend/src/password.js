import bcrypt from "bcryptjs";

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return "La contraseña debe tener al menos 8 caracteres y no superar 72 bytes";
  }
  return null;
}

export async function verifyPasswordChange(currentPassword, newPassword, hash) {
  const error = validatePassword(newPassword);
  if (error) return error;
  if (typeof currentPassword !== "string" || !(await bcrypt.compare(currentPassword, hash))) {
    return "La contraseña actual es incorrecta";
  }
  if (await bcrypt.compare(newPassword, hash)) return "La nueva contraseña debe ser diferente de la actual";
  return null;
}

export function canAccessWithoutMember(role, memberId, path) {
  return role !== "SOCIO" || Boolean(memberId) || ["/perfil", "/auth/permisos"].includes(path);
}

export async function savePasswordChange(prisma, user, passwordHash) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id: user.id, passwordHash: user.passwordHash, status: "ACTIVO", deletedAt: null },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null }
    });
    if (result.count !== 1) return false;
    await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return true;
  }, { isolationLevel: "Serializable" });
}
