-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AlterTable: 先加可空 userId（迁移 B 回填数据后再收紧为非空并加外键）
ALTER TABLE "Knowledge" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "Knowledge_userId_idx" ON "Knowledge"("userId");
