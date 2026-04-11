namespace LH.Licensing.Server.Application;

public sealed class LicenseFlowException : Exception
{
    public LicenseFlowException(string errorCode, string message)
        : base(message)
    {
        ErrorCode = errorCode;
    }

    public string ErrorCode { get; }
}
