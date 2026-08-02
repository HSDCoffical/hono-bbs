import { Hono } from 'hono';
import { jwtAuth } from '../../middleware/auth';
import { MessageService } from '../../services';

const api = new Hono();

api.get('/', jwtAuth, async (c) => {
  const user = c.get('user');
  const msgService = MessageService.getInstance(c.env.DB);
  const messages = await msgService.getMessagesForUser(user.id);
  return c.json(messages);
});

api.post('/:id/read', jwtAuth, async (c) => {
  const id = parseInt(c.req.param('id'));
  const msgService = MessageService.getInstance(c.env.DB);
  await msgService.markAsRead(id);
  return c.json({ success: true });
});

api.post('/admin/send', jwtAuth, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: '权限不足' }, 403);
  const body = await c.req.parseBody();
  const receiverId = parseInt(body.get('receiver_id') as string);
  const content = body.get('content') as string;

  const msgService = MessageService.getInstance(c.env.DB);
  if (receiverId === 0) {
    await msgService.sendSystemMessage(content);
  } else {
    await msgService.sendMessage(user.id, receiverId, content);
  }
  return c.json({ success: true });
});

export { api as messagesApi };