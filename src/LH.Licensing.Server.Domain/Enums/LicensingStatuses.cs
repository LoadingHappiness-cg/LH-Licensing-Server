namespace LH.Licensing.Server.Domain.Enums;

public enum CustomerStatus
{
    Active = 1,
    Inactive = 2
}

public enum ProductStatus
{
    Active = 1,
    Inactive = 2
}

public enum LicensePlanStatus
{
    Active = 1,
    Inactive = 2
}

public enum LicenseStatus
{
    Active = 1,
    Suspended = 2,
    Expired = 3,
    Revoked = 4
}

public enum InstallationStatus
{
    Active = 1,
    Blocked = 2
}

public enum ActivationStatus
{
    Active = 1,
    Revoked = 2,
    Expired = 3
}

public enum AuditEventType
{
    LicenseActivated = 1,
    LicenseRefreshed = 2,
    LicenseRevoked = 3,
    InstallationRegistered = 4,
    LicenseActivationDenied = 5,
    LicenseRefreshDenied = 6
}
