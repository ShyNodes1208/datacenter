using Datacenter.Api.Services;

namespace Datacenter.Api.Tests.UnitTests;

public sealed class RackCodeHeaderMatcherTests
{
    [Theory]
    [InlineData("机柜[2-2[06]]", "2-2[06]", true)]
    [InlineData("机柜[2-2[06]-B]", "2-2[06]-B", true)]
    [InlineData("机柜[2-2[06]-B]", "2-2[06]", false)]
    [InlineData("机柜[2-2[06]]", "2-2[06]-B", false)]
    [InlineData("机柜[RACK-DP-abc]", "RACK-DP-abc", true)]
    [InlineData("【2-2[06]】", "2-2[06]", true)]
    [InlineData("机柜X2-2[06]", "2-2[06]", false)]
    [InlineData("机柜2-2[06]B", "2-2[06]", false)]
    [InlineData("机柜A2-2[06]设备", "2-2[06]", false)]
    [InlineData("机柜[2-2[06]]", "06", false)]
    public void Matches_ExtractsBracketContentsForExactEquality(string header, string code, bool expected)
    {
        var normalized = ChineseSymbolNormalizer.Normalize(header);
        Assert.Equal(expected, RackCodeHeaderMatcher.Matches(normalized, code));
    }
}
