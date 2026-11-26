import { PrismaClient, Role, VigenciaStatus, MemberStatus, LoanType, LoanStatus, DebtStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedLoanPayment(loanId) {
  const existing = await prisma.loanPayment.findFirst({ where: { loanId, amount: "500.00" } });
  if (!existing) {
    await prisma.loanPayment.create({
      data: {
        loanId,
        amount: "500.00",
        principal: "450.00",
        interest: "50.00",
        mora: "0.00",
        previousBalance: "500450.00",
        newBalance: "500000.00",
        observations: "Pago de ejemplo"
      }
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed contiene usuarios y datos de demostración; no debe ejecutarse en producción.");
  }

  const vigencia2025 = await prisma.vigencia.upsert({
    where: { year: 2025 },
    update: {},
    create: { year: 2025, status: VigenciaStatus.CERRADA }
  });

  const vigencia = await prisma.vigencia.upsert({
    where: { year: 2026 },
    update: { deletedAt: null },
    create: { year: 2026, status: VigenciaStatus.ABIERTA }
  });

  const adminPasswordHash = await bcrypt.hash("Admin123*", 12);
  const socioPasswordHash = await bcrypt.hash("Socio123*", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@natillera.local" },
    update: { passwordHash: adminPasswordHash, deletedAt: null },
    create: { email: "admin@natillera.local", passwordHash: adminPasswordHash, role: Role.ADMINISTRADOR }
  });

  const socioUser = await prisma.user.upsert({
    where: { email: "ana@socios.local" },
    update: { passwordHash: socioPasswordHash, deletedAt: null },
    create: { email: "ana@socios.local", passwordHash: socioPasswordHash, role: Role.SOCIO }
  });

  const lili = await prisma.member.upsert({
    where: { document: "1000000001" },
    update: { deletedAt: null, vigenciaId: vigencia.id },
    create: {
      document: "1000000001",
      firstName: "Lili",
      lastName: "Administradora",
      phone: "3000000000",
      email: "admin@natillera.local",
      raffleNumber: "01",
      role: Role.ADMINISTRADOR,
      status: MemberStatus.ACTIVO,
      vigenciaId: vigencia.id,
      userId: adminUser.id
    }
  });

  const ana = await prisma.member.upsert({
    where: { document: "1000000002" },
    update: { deletedAt: null, vigenciaId: vigencia.id, userId: socioUser.id },
    create: {
      document: "1000000002",
      firstName: "Ana",
      lastName: "Socio",
      phone: "3000000001",
      email: "ana@socios.local",
      raffleNumber: "02",
      role: Role.SOCIO,
      status: MemberStatus.ACTIVO,
      vigenciaId: vigencia.id,
      userId: socioUser.id
    }
  });

  const carlos = await prisma.member.upsert({
    where: { document: "1000000003" },
    update: { deletedAt: null, vigenciaId: vigencia.id },
    create: {
      document: "1000000003",
      firstName: "Carlos",
      lastName: "Martinez",
      phone: "3000000002",
      raffleNumber: "03",
      role: Role.SOCIO,
      status: MemberStatus.ACTIVO,
      vigenciaId: vigencia.id
    }
  });

  if (!(await prisma.saving.findFirst({ where: { memberId: ana.id, vigenciaId: vigencia.id, observation: "Aporte inicial de ejemplo" } }))) {
    await prisma.saving.create({
      data: { memberId: ana.id, vigenciaId: vigencia.id, amount: "250000.00", observation: "Aporte inicial de ejemplo" }
    });
  }
  if (!(await prisma.saving.findFirst({ where: { memberId: carlos.id, vigenciaId: vigencia.id, observation: "Aporte mensual de ejemplo" } }))) {
    await prisma.saving.create({
      data: { memberId: carlos.id, vigenciaId: vigencia.id, amount: "180000.00", observation: "Aporte mensual de ejemplo" }
    });
  }

  let loan = await prisma.loan.findFirst({ where: { borrowerName: "Préstamo de ejemplo - Ana", vigenciaId: vigencia.id } });
  if (!loan) {
    loan = await prisma.loan.create({
      data: {
        borrowerName: "Préstamo de ejemplo - Ana",
        memberId: ana.id,
        type: LoanType.SOCIO,
        principal: "1000000.00",
        rate: "5.00",
        installments: 12,
        balance: "500000.00",
        status: LoanStatus.ACTIVO,
        vigenciaId: vigencia.id
      }
    });
  }
  await seedLoanPayment(loan.id);

  let activity = await prisma.activity.findFirst({ where: { name: "Venta comunitaria", vigenciaId: vigencia.id } });
  if (!activity) {
    activity = await prisma.activity.create({
      data: {
        name: "Venta comunitaria",
        description: "Actividad recreativa y de recaudo de ejemplo",
        income: "800000.00",
        costs: "250000.00",
        vigenciaId: vigencia.id
      }
    });
  }
  await prisma.activityParticipant.createMany({
    data: [
      { activityId: activity.id, memberId: ana.id, gain: "275000.00" },
      { activityId: activity.id, memberId: carlos.id, gain: "275000.00" }
    ],
    skipDuplicates: true
  });

  if (!(await prisma.raffle.findFirst({ where: { vigenciaId: vigencia.id, winningNumber: "03" } }))) {
    await prisma.raffle.create({
      data: {
        winningNumber: "03",
        prize: "300000.00",
        vigenciaId: vigencia.id,
        winnerId: carlos.id
      }
    });
  }

  if (!(await prisma.debt.findFirst({ where: { memberId: ana.id, vigenciaId: vigencia.id, concept: "Cuota social pendiente" } }))) {
    await prisma.debt.create({
      data: {
        memberId: ana.id,
        vigenciaId: vigencia.id,
        concept: "Cuota social pendiente",
        amount: "75000.00",
        status: DebtStatus.PENDIENTE
      }
    });
  }

  await prisma.liquidation.upsert({
    where: { vigenciaId_memberId: { vigenciaId: vigencia2025.id, memberId: ana.id } },
    update: {},
    create: {
      vigenciaId: vigencia2025.id,
      memberId: ana.id,
      savings: "1200000.00",
      activityGain: "220000.00",
      loanGain: "180000.00",
      raffleGain: "0.00",
      adminCommission: "50000.00",
      debtsDiscounted: "30000.00",
      finalAmount: "1520000.00",
      roleSnapshot: Role.SOCIO
    }
  });

  console.log("Seed completed: vigencias, usuarios, socios, ahorros, préstamos, pagos, actividades, rifas, deudas y liquidaciones");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
