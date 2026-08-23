-- DropIndex（遗留表清理；IF EXISTS 保证全新安装时也安全）
DROP INDEX IF EXISTS "_DocumentToTag_B_index";

-- DropIndex
DROP INDEX IF EXISTS "_DocumentToTag_AB_unique";

-- DropTable
DROP TABLE IF EXISTS "Tag";

-- DropTable
DROP TABLE IF EXISTS "_DocumentToTag";

-- RedefineTables：Knowledge.userId 收紧为非空并加外键（迁移 A 已回填全部数据）
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Knowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Knowledge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Knowledge" ("createdAt", "description", "id", "name", "status", "updatedAt", "userId") SELECT "createdAt", "description", "id", "name", "status", "updatedAt", "userId" FROM "Knowledge";
DROP TABLE "Knowledge";
ALTER TABLE "new_Knowledge" RENAME TO "Knowledge";
CREATE INDEX "Knowledge_userId_idx" ON "Knowledge"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
