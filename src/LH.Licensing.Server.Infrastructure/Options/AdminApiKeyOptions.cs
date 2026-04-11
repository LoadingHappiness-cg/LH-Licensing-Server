namespace LH.Licensing.Server.Infrastructure.Options;

public sealed class AdminApiKeyOptions
{
    public const string SectionName = "Admin";

    public string? ApiKey { get; init; }

    public string? ActorId { get; init; }
}
