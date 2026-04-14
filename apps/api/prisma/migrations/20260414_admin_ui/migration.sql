-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LicensePlan` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `durationDays` INTEGER NULL,
    `maxCompanies` INTEGER NULL,
    `maxWorkstations` INTEGER NULL,
    `entitlements` JSON NOT NULL,
    `notes` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LicensePlan_productId_code_key`(`productId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `License` (
    `id` VARCHAR(191) NOT NULL,
    `licenseKey` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `overrides` JSON NULL,
    `hardwareHash` VARCHAR(191) NULL,
    `rebindCount` INTEGER NOT NULL DEFAULT 0,
    `rebindPeriod` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `License_licenseKey_key`(`licenseKey`),
    INDEX `License_customerId_idx`(`customerId`),
    INDEX `License_productId_idx`(`productId`),
    INDEX `License_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivationToken` (
    `id` VARCHAR(191) NOT NULL,
    `licenseId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,

    UNIQUE INDEX `ActivationToken_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Installation` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `licenseId` VARCHAR(191) NULL,
    `appId` VARCHAR(191) NOT NULL,
    `machineFingerprintHash` VARCHAR(191) NOT NULL,
    `deviceName` VARCHAR(191) NULL,
    `osInfo` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'BLOCKED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Installation_appId_idx`(`appId`),
    INDEX `Installation_machineFingerprintHash_idx`(`machineFingerprintHash`),
    INDEX `Installation_licenseId_idx`(`licenseId`),
    UNIQUE INDEX `Installation_appId_machineFingerprintHash_key`(`appId`, `machineFingerprintHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activation` (
    `id` VARCHAR(191) NOT NULL,
    `licenseId` VARCHAR(191) NOT NULL,
    `installationId` VARCHAR(191) NOT NULL,
    `refreshTokenHash` VARCHAR(191) NULL,
    `tokenJti` VARCHAR(191) NULL,
    `clientVersion` VARCHAR(191) NULL,
    `activatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `lastRefreshedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Activation_licenseId_idx`(`licenseId`),
    INDEX `Activation_installationId_idx`(`installationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `eventType` ENUM('ACTIVATE', 'REFRESH', 'REVOKE', 'REBIND', 'REBIND_DENIED', 'ADMIN_CREATE', 'ADMIN_UPDATE', 'ADMIN_REVOKE', 'INSTALLATION_BLOCKED', 'LICENSE_EXPIRED') NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `licenseId` VARCHAR(191) NULL,
    `installationId` VARCHAR(191) NULL,
    `actorType` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `payload` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditEvent_eventType_idx`(`eventType`),
    INDEX `AuditEvent_customerId_idx`(`customerId`),
    INDEX `AuditEvent_productId_idx`(`productId`),
    INDEX `AuditEvent_licenseId_idx`(`licenseId`),
    INDEX `AuditEvent_installationId_idx`(`installationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LicensePlan` ADD CONSTRAINT `LicensePlan_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `License` ADD CONSTRAINT `License_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `License` ADD CONSTRAINT `License_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `License` ADD CONSTRAINT `License_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `LicensePlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivationToken` ADD CONSTRAINT `ActivationToken_licenseId_fkey` FOREIGN KEY (`licenseId`) REFERENCES `License`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Installation` ADD CONSTRAINT `Installation_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Installation` ADD CONSTRAINT `Installation_licenseId_fkey` FOREIGN KEY (`licenseId`) REFERENCES `License`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activation` ADD CONSTRAINT `Activation_licenseId_fkey` FOREIGN KEY (`licenseId`) REFERENCES `License`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activation` ADD CONSTRAINT `Activation_installationId_fkey` FOREIGN KEY (`installationId`) REFERENCES `Installation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_licenseId_fkey` FOREIGN KEY (`licenseId`) REFERENCES `License`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_installationId_fkey` FOREIGN KEY (`installationId`) REFERENCES `Installation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
