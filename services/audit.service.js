const prisma = require('../lib/prisma');

async function audit(req, action, entity, entityId, metadata) {
  const data = {
    actorId: req.session?.user?.id || null,
    action,
    entity: entity || null,
    entityId: entityId == null ? null : String(entityId),
    metadataJson: metadata ? JSON.stringify(metadata) : null,
    ip: String(req.ip || '').slice(0, 120) || null,
  };

  try {
    await prisma.auditLog.create({ data });
  } catch (error) {
    // Защита от устаревшей сессии: если пользователь уже удалён,
    // само бизнес-действие не должно ломаться из-за FK журнала.
    if (error?.code === 'P2003' && data.actorId) {
      try {
        await prisma.auditLog.create({
          data: {
            ...data,
            actorId: null,
            metadataJson: JSON.stringify({
              ...(metadata || {}),
              staleActorId: data.actorId,
            }),
          },
        });
        return;
      } catch (retryError) {
        console.error('Не удалось записать audit log:', retryError.message);
        return;
      }
    }

    console.error('Не удалось записать audit log:', error.message);
  }
}

module.exports = audit;
