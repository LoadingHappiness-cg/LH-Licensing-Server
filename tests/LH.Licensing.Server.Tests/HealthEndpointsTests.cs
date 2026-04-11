using System.Net;

namespace LH.Licensing.Server.Tests;

public sealed class HealthEndpointsTests : IClassFixture<TestApplicationFactory>
{
    private readonly HttpClient _client;

    public HealthEndpointsTests(TestApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetHealthReturnsOk()
    {
        var response = await _client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetHealthReadyReturnsOkWhenDatabaseConnects()
    {
        var response = await _client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
