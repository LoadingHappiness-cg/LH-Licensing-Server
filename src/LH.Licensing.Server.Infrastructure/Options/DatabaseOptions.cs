namespace LH.Licensing.Server.Infrastructure.Options;

public sealed class DatabaseOptions
{
    public const string SectionName = "ConnectionStrings";

    public string? Database { get; init; }
}
