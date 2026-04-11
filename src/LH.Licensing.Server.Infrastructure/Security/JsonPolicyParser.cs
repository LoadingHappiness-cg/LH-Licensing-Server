using System.Text.Json;

namespace LH.Licensing.Server.Infrastructure.Security;

public static class JsonPolicyParser
{
    public static string[] ParseAllowedAppIds(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<string>();
        }

        return JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>();
    }

    public static (int MaxActivations, int OfflineGraceDays, string[] Features) ParseEntitlements(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return (0, 0, Array.Empty<string>());
        }

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        var maxActivations = root.TryGetProperty("max_activations", out var maxActivationsValue) ? maxActivationsValue.GetInt32() : 0;
        var offlineGraceDays = root.TryGetProperty("offline_grace_days", out var offlineGraceValue) ? offlineGraceValue.GetInt32() : 0;
        var features = root.TryGetProperty("features", out var featuresValue) && featuresValue.ValueKind == JsonValueKind.Array
            ? featuresValue.EnumerateArray().Select(x => x.GetString() ?? string.Empty).Where(x => !string.IsNullOrWhiteSpace(x)).ToArray()
            : Array.Empty<string>();

        return (maxActivations, offlineGraceDays, features);
    }
}
