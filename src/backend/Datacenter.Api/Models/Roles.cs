namespace Datacenter.Api.Models;

public static class Roles
{
    public const string RoomAdministrator = "机房管理员";
    public const string Operations = "运维人员";
    public const string DbaApplicationOperations = "DBA/应用运维人员";
    public const string ReadOnlyViewer = "只读查看人员";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        RoomAdministrator,
        Operations,
        DbaApplicationOperations,
        ReadOnlyViewer
    };
}
