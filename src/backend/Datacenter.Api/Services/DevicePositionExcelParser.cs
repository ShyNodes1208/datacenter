using System.Linq;
using ClosedXML.Excel;
using Datacenter.Api.Models;

namespace Datacenter.Api.Services;

/// <summary>
/// Shared Excel parsing for single-rack and batch device-position import.
/// </summary>
public static class DevicePositionExcelParser
{
    public static int? FindRackColumn(IXLWorksheet worksheet, string rackCode)
    {
        var lastColumn = worksheet.Row(1).LastCellUsed()?.Address.ColumnNumber ?? 0;

        for (var col = 1; col <= lastColumn; col++)
        {
            var headerText = worksheet.Cell(1, col).GetString().Trim();
            if (string.IsNullOrWhiteSpace(headerText))
            {
                continue;
            }

            var normalized = ChineseSymbolNormalizer.Normalize(headerText);
            if (RackCodeHeaderMatcher.Matches(normalized, rackCode))
            {
                return col;
            }
        }

        return null;
    }

    public static List<(int StartColumn, Rack Rack)> FindCabinetColumns(
        IXLWorksheet worksheet,
        IReadOnlyList<Rack> racks)
    {
        var lastColumn = worksheet.Row(1).LastCellUsed()?.Address.ColumnNumber ?? 0;
        var cabinetColumns = new List<(int StartColumn, Rack Rack)>();

        for (var col = 1; col <= lastColumn; col++)
        {
            var headerText = worksheet.Cell(1, col).GetString().Trim();
            if (string.IsNullOrWhiteSpace(headerText))
            {
                continue;
            }

            var normalized = ChineseSymbolNormalizer.Normalize(headerText);
            var matchedRack = racks.FirstOrDefault(r =>
                RackCodeHeaderMatcher.Matches(normalized, r.Code));

            if (matchedRack is not null)
            {
                cabinetColumns.Add((col, matchedRack));
            }
        }

        return cabinetColumns;
    }

    public static (List<string> Errors, Dictionary<int, (string? Label, int UHeight)> Positions) ParseForRack(
        IXLWorksheet worksheet,
        string rackCode,
        int heightU)
    {
        var startColumn = FindRackColumn(worksheet, rackCode);
        if (startColumn is null)
        {
            return (
                new List<string> { $"Excel 中未找到机柜 '{rackCode}' 的数据列" },
                new Dictionary<int, (string? Label, int UHeight)>());
        }

        return ParseColumn(worksheet, startColumn.Value, heightU);
    }

    public static (List<string> Errors, Dictionary<int, (string? Label, int UHeight)> Positions) ParseColumn(
        IXLWorksheet worksheet,
        int uNumberCol,
        int heightU)
    {
        var labelCol = uNumberCol + 1;
        var importData = new Dictionary<int, (string? Label, int UHeight)>();
        var errors = new List<string>();
        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;

        for (var row = 2; row <= lastRow; row++)
        {
            var uNumberText = worksheet.Cell(row, uNumberCol).GetString().Trim();
            if (string.IsNullOrWhiteSpace(uNumberText))
            {
                continue;
            }

            var uNumberStr = uNumberText.TrimEnd('U', 'u');
            if (!int.TryParse(uNumberStr, out var uNumber) || uNumber < 1)
            {
                errors.Add($"第 {row} 行 U 位编号无效：'{uNumberText}'");
                continue;
            }

            if (uNumber > heightU)
            {
                errors.Add($"第 {row} 行 U 位编号 {uNumber} 超出机柜 U 位范围 (1-{heightU})");
                continue;
            }

            var labelCell = worksheet.Cell(row, labelCol);
            string? label;
            int uHeight;

            if (labelCell.IsMerged())
            {
                var mergedRange = worksheet.MergedRanges.First(r => r.Contains(labelCell.Address.ToString()));
                if (labelCell.Address.ToString() != mergedRange.FirstCell().Address.ToString())
                {
                    continue;
                }

                label = mergedRange.FirstCell().GetString().Trim();
                uHeight = mergedRange.RowCount();
            }
            else
            {
                label = labelCell.GetString().Trim();
                uHeight = 1;
            }

            importData[uNumber] = (string.IsNullOrWhiteSpace(label) ? null : label, uHeight);
        }

        return (errors, importData);
    }
}
