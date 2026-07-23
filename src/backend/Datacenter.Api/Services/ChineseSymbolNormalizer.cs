namespace Datacenter.Api.Services;

public static class ChineseSymbolNormalizer
{
    private static readonly IReadOnlyDictionary<char, char> Map = new Dictionary<char, char>
    {
        ['【'] = '[',
        ['】'] = ']',
        ['（'] = '(',
        ['）'] = ')',
        ['：'] = ':',
        ['，'] = ',',
        ['；'] = ';',
    };

    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        var trimmed = input.Trim();
        var chars = trimmed.ToCharArray();
        var changed = false;

        for (var i = 0; i < chars.Length; i++)
        {
            if (Map.TryGetValue(chars[i], out var replacement))
            {
                chars[i] = replacement;
                changed = true;
            }
        }

        return changed ? new string(chars) : trimmed;
    }
}
