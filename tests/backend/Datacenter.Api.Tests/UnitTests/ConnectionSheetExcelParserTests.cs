using Datacenter.Api.Services.ConnectionSheet;

namespace Datacenter.Api.Tests.UnitTests;

public sealed class ConnectionSheetExcelParserTests
{
    [Theory]
    [InlineData("2-8U", 2, 7)]
    [InlineData("20_21U", 20, 2)]
    [InlineData("18-19U", 18, 2)]
    [InlineData("39U", 39, 1)]
    public void ParseURange_parses_common_formats(string text, int start, int height)
    {
        var (parsedStart, parsedHeight) = ConnectionSheetExcelParser.ParseURange(text);
        Assert.Equal(start, parsedStart);
        Assert.Equal(height, parsedHeight);
    }

    [Theory]
    [InlineData("10.4.122.180", true)]
    [InlineData("2,032", false)]
    [InlineData("2、2002", false)]
    public void IsValidIpv4_validates_addresses(string value, bool expected)
    {
        Assert.Equal(expected, ConnectionSheetExcelParser.IsValidIpv4(value));
    }

    [Theory]
    [InlineData("OM3", "光纤")]
    [InlineData("DAC", "DAC")]
    [InlineData("铜缆", "铜缆")]
    public void NormalizeCableType_maps_known_values(string raw, string expected)
    {
        Assert.Equal(expected, ConnectionSheetExcelParser.NormalizeCableType(raw));
    }

    [Fact]
    public void GeneratePlaceholderIp_returns_unique_values()
    {
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var first = ConnectionSheetExcelParser.GeneratePlaceholderIp("device-a", used);
        var second = ConnectionSheetExcelParser.GeneratePlaceholderIp("device-b", used);
        Assert.NotEqual(first, second);
        Assert.StartsWith("10.255.", first);
    }
}
