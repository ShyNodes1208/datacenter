using System.Globalization;
using System.Text.RegularExpressions;
using ClosedXML.Excel;

namespace Datacenter.Api.Services.ConnectionSheet;

public static class ConnectionSheetExcelParser
{
    private static readonly string[] RequiredHeaders =
    [
        "本端端口", "机房", "机柜", "U位",
        "对端交换机", "对端交换机接口", "对端机柜", "对端机柜U位", "线缆类型"
    ];

    public static (List<ConnectionSheetRow> Rows, List<ConnectionSheetRowIssue> Issues, int ScannedRows) Parse(Stream stream)
    {
        using var workbook = new XLWorkbook(stream);
        var worksheet = workbook.Worksheets.FirstOrDefault()
            ?? throw new InvalidOperationException("Excel 文件不包含工作表");

        var headerMap = BuildHeaderMap(worksheet);
        var missing = RequiredHeaders.Where(h => !headerMap.ContainsKey(h)).ToList();
        if (missing.Count > 0)
            throw new InvalidOperationException($"缺少必填列: {string.Join(", ", missing)}");

        var rows = new List<ConnectionSheetRow>();
        var issues = new List<ConnectionSheetRowIssue>();
        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;
        var scannedRows = 0;

        for (var row = 2; row <= lastRow; row++)
        {
            var localPort = Cell(worksheet, row, headerMap, "本端端口");
            var room = Cell(worksheet, row, headerMap, "机房");
            var rack = Cell(worksheet, row, headerMap, "机柜");
            var uText = Cell(worksheet, row, headerMap, "U位");
            var switchName = Cell(worksheet, row, headerMap, "对端交换机");
            var switchPort = Cell(worksheet, row, headerMap, "对端交换机接口");
            var peerRack = Cell(worksheet, row, headerMap, "对端机柜");
            var peerU = Cell(worksheet, row, headerMap, "对端机柜U位");
            var cableType = Cell(worksheet, row, headerMap, "线缆类型");

            if (IsEmptyRow(localPort, room, rack, uText, switchName, switchPort, peerRack, peerU, cableType))
                continue;

            scannedRows++;
            var rowIssues = new List<string>();
            if (string.IsNullOrWhiteSpace(localPort)) rowIssues.Add("本端端口为空");
            if (string.IsNullOrWhiteSpace(room)) rowIssues.Add("机房为空");
            if (string.IsNullOrWhiteSpace(rack)) rowIssues.Add("机柜为空");
            if (string.IsNullOrWhiteSpace(uText)) rowIssues.Add("U位为空");
            if (string.IsNullOrWhiteSpace(switchName)) rowIssues.Add("对端交换机为空");
            if (string.IsNullOrWhiteSpace(switchPort)) rowIssues.Add("对端交换机接口为空");
            if (string.IsNullOrWhiteSpace(peerRack)) rowIssues.Add("对端机柜为空");
            if (string.IsNullOrWhiteSpace(peerU)) rowIssues.Add("对端机柜U位为空");
            if (string.IsNullOrWhiteSpace(cableType)) rowIssues.Add("线缆类型为空");

            if (rowIssues.Count > 0)
            {
                foreach (var message in rowIssues)
                    issues.Add(new ConnectionSheetRowIssue(row, message, true));
                continue;
            }

            rows.Add(new ConnectionSheetRow(
                RowNumber: row,
                Brand: NullIfEmpty(Cell(worksheet, row, headerMap, "品牌")),
                DeviceType: NullIfEmpty(Cell(worksheet, row, headerMap, "设备类型")),
                Model: NullIfEmpty(Cell(worksheet, row, headerMap, "型号")),
                Serial: NullIfEmpty(Cell(worksheet, row, headerMap, "序列号")),
                LocalPort: localPort!,
                Room: room!,
                Rack: rack!,
                UText: uText!,
                SwitchName: switchName!,
                SwitchPort: switchPort!,
                PeerRack: peerRack!,
                PeerUText: peerU!,
                InterfaceType: NullIfEmpty(Cell(worksheet, row, headerMap, "接口类型")),
                CableType: cableType!,
                OutOfBandIp: NullIfEmpty(Cell(worksheet, row, headerMap, "带外管理IP")),
                Notes: NullIfEmpty(Cell(worksheet, row, headerMap, "备注"))));
        }

        return (rows, issues, scannedRows);
    }

    public static string LocalDeviceKey(string room, string rack, int startU, int heightU, string? serial) =>
        $"L|{NormalizeKeyPart(room)}|{NormalizeKeyPart(rack)}|{startU}|{heightU}|{NormalizeKeyPart(serial ?? string.Empty)}";

    public static string RemoteDeviceKey(string room, string peerRack, int startU, int heightU, string switchName) =>
        $"S|{NormalizeKeyPart(room)}|{NormalizeKeyPart(peerRack)}|{startU}|{heightU}|{NormalizeKeyPart(switchName)}";

    public static (int StartU, int HeightU) ParseURange(string text)
    {
        var normalized = text.Trim().ToUpperInvariant().Replace("U", string.Empty).Replace("_", "-");
        if (string.IsNullOrWhiteSpace(normalized))
            throw new FormatException("U位为空");

        if (normalized.Contains('-', StringComparison.Ordinal))
        {
            var parts = normalized.Split('-', 2, StringSplitOptions.TrimEntries);
            if (!int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var start)
                || !int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var end))
                throw new FormatException($"无法解析 U 位范围: {text}");
            if (start < 1 || end < start)
                throw new FormatException($"无效 U 位范围: {text}");
            return (start, end - start + 1);
        }

        if (!int.TryParse(normalized, NumberStyles.Integer, CultureInfo.InvariantCulture, out var single) || single < 1)
            throw new FormatException($"无效 U 位: {text}");
        return (single, 1);
    }

    public static bool IsValidIpv4(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;
        var parts = value.Trim().Split('.');
        if (parts.Length != 4)
            return false;
        foreach (var part in parts)
        {
            if (!int.TryParse(part, NumberStyles.Integer, CultureInfo.InvariantCulture, out var octet))
                return false;
            if (octet < 0 || octet > 255)
                return false;
        }
        return true;
    }

    public static string NormalizeCableType(string raw)
    {
        var value = raw.Trim();
        if (string.IsNullOrEmpty(value))
            return value;
        var upper = value.ToUpperInvariant();
        if (upper is "OM1" or "OM2" or "OM3" or "OM4" or "OS2" or "光纤")
            return "光纤";
        if (upper is "DAC" or "AOC")
            return "DAC";
        if (value.Contains("铜", StringComparison.Ordinal) || value.Contains("电", StringComparison.Ordinal))
            return "铜缆";
        return value;
    }

    public static string NormalizePortType(string? interfaceType)
    {
        if (string.IsNullOrWhiteSpace(interfaceType))
            return "RJ45";
        if (interfaceType.Contains("光", StringComparison.Ordinal)
            || interfaceType.Contains("SFP", StringComparison.OrdinalIgnoreCase))
            return "SFP+";
        return "RJ45";
    }

    public static string NormalizeLocalDeviceType(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return "服务器";
        if (raw.Contains("交换", StringComparison.Ordinal)
            || raw.Equals("switch", StringComparison.OrdinalIgnoreCase))
            return "交换机";
        return "服务器";
    }

    public static string BuildLocalDisplayName(ConnectionSheetRow row)
    {
        if (!string.IsNullOrWhiteSpace(row.Model) && !string.IsNullOrWhiteSpace(row.Serial))
            return $"{row.Model}-{row.Serial}";
        if (!string.IsNullOrWhiteSpace(row.Serial))
            return row.Serial;
        return $"{row.Rack}@{row.UText}";
    }

    public static string? ExtractCableLength(string? notes)
    {
        if (string.IsNullOrWhiteSpace(notes))
            return null;
        var match = Regex.Match(notes, @"(\d+(?:\.\d+)?)\s*米");
        return match.Success ? $"{match.Groups[1].Value}米" : null;
    }

    public static string GeneratePlaceholderIp(string seed, ISet<string> used)
    {
        var hash = StableHash(seed);
        for (var attempt = 0; attempt < 65536; attempt++)
        {
            var candidate = $"10.255.{(hash + attempt) / 256 % 256}.{(hash + attempt) % 256}";
            if (used.Add(candidate))
                return candidate;
        }

        throw new InvalidOperationException("无法生成唯一占位管理 IP");
    }

    private static Dictionary<string, int> BuildHeaderMap(IXLWorksheet worksheet)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var headerRow = worksheet.Row(1);
        var lastCol = headerRow.LastCellUsed()?.Address.ColumnNumber ?? 0;
        for (var col = 1; col <= lastCol; col++)
        {
            var header = headerRow.Cell(col).GetString().Trim();
            if (!string.IsNullOrEmpty(header))
                map[header] = col;
        }
        return map;
    }

    private static string? Cell(IXLWorksheet ws, int row, IReadOnlyDictionary<string, int> map, string header) =>
        map.TryGetValue(header, out var col)
            ? NullIfEmpty(ws.Cell(row, col).GetString().Trim())
            : null;

    private static bool IsEmptyRow(params string?[] values) =>
        values.All(string.IsNullOrWhiteSpace);

    private static string? NullIfEmpty(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string NormalizeKeyPart(string value) =>
        value.Trim().ToUpperInvariant();

    private static int StableHash(string value)
    {
        unchecked
        {
            var hash = 17;
            foreach (var ch in value)
                hash = (hash * 31) + ch;
            return Math.Abs(hash);
        }
    }
}
