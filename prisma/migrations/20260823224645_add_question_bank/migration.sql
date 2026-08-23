-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '未分类',
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "Knowledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PracticeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'question',
    "userAnswer" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT NOT NULL DEFAULT '',
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeRecord_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Question_knowledgeId_category_idx" ON "Question"("knowledgeId", "category");

-- CreateIndex
CREATE INDEX "Question_knowledgeId_difficulty_idx" ON "Question"("knowledgeId", "difficulty");

-- CreateIndex
CREATE INDEX "PracticeRecord_userId_idx" ON "PracticeRecord"("userId");

-- CreateIndex
CREATE INDEX "PracticeRecord_questionId_idx" ON "PracticeRecord"("questionId");

