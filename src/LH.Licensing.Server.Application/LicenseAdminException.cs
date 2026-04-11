namespace LH.Licensing.Server.Application;

public sealed class LicenseAdminException : Exception
{
    public LicenseAdminException(string errorCode, string message, int statusCode)
        : base(message)
    {
        ErrorCode = errorCode;
        StatusCode = statusCode;
    }

    public string ErrorCode { get; }

    public int StatusCode { get; }
}
