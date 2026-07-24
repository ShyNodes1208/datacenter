using Datacenter.Api.Data;
using Datacenter.Api.Models;

namespace Datacenter.Api.Services;

public static class AuditService
{
    public static void Record(
        AppDbContext dbContext,
        Server server,
        string operationType,
        string? fromPosition,
        string? toPosition,
        string operatorUsername,
        string? notes = null)
    {
        dbContext.AuditRecords.Add(new AuditRecord
        {
            ServerId = server.Id,
            OperationType = operationType,
            FromPosition = fromPosition,
            ToPosition = toPosition,
            OperatorUsername = operatorUsername,
            OperatedAt = DateTime.UtcNow,
            Notes = notes
        });
    }
}
