namespace LH.Licensing.Server.Infrastructure.Options;

public sealed class ProxyOptions
{
    public const string SectionName = "Proxy";

    public List<string> KnownProxies { get; init; } = [];

    public int ForwardLimit { get; init; } = 1;

    public bool RequireHeaderSymmetry { get; init; } = false;
}
