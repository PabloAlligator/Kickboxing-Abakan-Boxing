const prisma = require('../lib/prisma');

async function audit(req, action, entity, entityId, metadata) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.session?.user?.id || null,
        action,
        entity: entity || null,
        entityId: entityId == null ? null : String(entityId),
        metadataJson: metadata ? JSON.stringify(metadata) : null,
        ip: String(req.ip || '').slice(0, 120) || null
      }
    });
  } catch (error) {
    console.error('Не удалось записать audit log:', error.message);
  }
}

module.exports = audit;
