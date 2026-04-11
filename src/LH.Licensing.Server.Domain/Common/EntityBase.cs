namespace LH.Licensing.Server.Domain.Common;

public abstract class EntityBase
{
    public Guid Id { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }
}
