-- AlterTable
ALTER TABLE `LicensePlan`
    ADD COLUMN `renewalCadenceMonths` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `License`
    ADD COLUMN `renewalCadenceMonths` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `renewalCadenceSource` ENUM('PLAN', 'LICENSE') NOT NULL DEFAULT 'PLAN';

-- Backfill plan cadence from legacy duration values.
UPDATE `LicensePlan`
SET `renewalCadenceMonths` = CASE
  WHEN `durationDays` IS NULL OR `durationDays` <= 0 THEN 1
  ELSE GREATEST(1, CAST(ROUND(`durationDays` / 30) AS UNSIGNED))
END;

-- Backfill license cadence from the plan snapshot, or a sensible fallback when no plan exists.
UPDATE `License` l
LEFT JOIN `LicensePlan` p ON p.id = l.`planId`
SET l.`renewalCadenceMonths` = COALESCE(p.`renewalCadenceMonths`, 1),
    l.`renewalCadenceSource` = CASE
      WHEN l.`planId` IS NULL THEN 'LICENSE'
      ELSE 'PLAN'
    END;
