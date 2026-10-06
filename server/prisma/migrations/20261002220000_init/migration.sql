-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('LIBRO', 'APUNTE', 'CALCULADORA', 'INSTRUMENTAL', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoConservacion" AS ENUM ('NUEVO', 'BUENO', 'USADO');

-- CreateEnum
CREATE TYPE "EstadoItem" AS ENUM ('DISPONIBLE', 'RESERVADO', 'INTERCAMBIADO', 'PAUSADO');

-- CreateEnum
CREATE TYPE "EstadoPropuesta" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'CANCELADA', 'CONCRETADA');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "carrera" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" "Categoria" NOT NULL,
    "estadoConservacion" "EstadoConservacion" NOT NULL,
    "materia" TEXT,
    "fotoUrl" TEXT,
    "estado" "EstadoItem" NOT NULL DEFAULT 'DISPONIBLE',
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" SERIAL NOT NULL,
    "itemSolicitadoId" INTEGER NOT NULL,
    "itemOfrecidoId" INTEGER NOT NULL,
    "proponenteId" INTEGER NOT NULL,
    "receptorId" INTEGER NOT NULL,
    "mensaje" TEXT,
    "estado" "EstadoPropuesta" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" SERIAL NOT NULL,
    "proposalId" INTEGER NOT NULL,
    "evaluadorId" INTEGER NOT NULL,
    "evaluadoId" INTEGER NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Item_ownerId_idx" ON "Item"("ownerId");

-- CreateIndex
CREATE INDEX "Item_estado_createdAt_idx" ON "Item"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "Proposal_proponenteId_estado_idx" ON "Proposal"("proponenteId", "estado");

-- CreateIndex
CREATE INDEX "Proposal_receptorId_estado_idx" ON "Proposal"("receptorId", "estado");

-- CreateIndex
CREATE INDEX "Proposal_itemSolicitadoId_idx" ON "Proposal"("itemSolicitadoId");

-- CreateIndex
CREATE INDEX "Proposal_itemOfrecidoId_idx" ON "Proposal"("itemOfrecidoId");

-- CreateIndex
CREATE INDEX "Rating_evaluadoId_idx" ON "Rating"("evaluadoId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_proposalId_evaluadorId_key" ON "Rating"("proposalId", "evaluadorId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_itemSolicitadoId_fkey" FOREIGN KEY ("itemSolicitadoId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_itemOfrecidoId_fkey" FOREIGN KEY ("itemOfrecidoId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_proponenteId_fkey" FOREIGN KEY ("proponenteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_receptorId_fkey" FOREIGN KEY ("receptorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_evaluadorId_fkey" FOREIGN KEY ("evaluadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_evaluadoId_fkey" FOREIGN KEY ("evaluadoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricción manual: Prisma no soporta CHECK en el schema.
-- El puntaje de una calificación debe estar entre 1 y 5 (HU-09).
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_puntaje_check" CHECK ("puntaje" BETWEEN 1 AND 5);
