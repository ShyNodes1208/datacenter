namespace Datacenter.Api.Services;

/// <summary>
/// Matches a rack code in an Excel header by extracting bracket-wrapped codes
/// (e.g. [2-2[06]]) and comparing them for exact equality.
/// </summary>
public static class RackCodeHeaderMatcher
{
    public static bool Matches(string normalizedHeader, string rackCode)
    {
        if (string.IsNullOrEmpty(rackCode) || string.IsNullOrEmpty(normalizedHeader))
        {
            return false;
        }

        foreach (var extracted in ExtractBracketContents(normalizedHeader))
        {
            if (string.Equals(extracted, rackCode, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static IEnumerable<string> ExtractBracketContents(string text)
    {
        for (var i = 0; i < text.Length; i++)
        {
            if (text[i] != '[')
            {
                continue;
            }

            var depth = 1;
            for (var j = i + 1; j < text.Length; j++)
            {
                if (text[j] == '[')
                {
                    depth++;
                }
                else if (text[j] == ']')
                {
                    depth--;
                    if (depth == 0)
                    {
                        yield return text[(i + 1)..j];
                        i = j;
                        break;
                    }
                }
            }
        }
    }
}
