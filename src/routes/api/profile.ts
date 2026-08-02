import { Hono } from 'hono';
import { jwtAuth } from '../../middleware/auth';
import { ProfileService, UserService } from '../../services';

const api = new Hono();

api.post('/update', jwtAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { email, bio, avatar, website, location } = body;

  const userService = UserService.getInstance(c.env.DB);
  const profileService = ProfileService.getInstance(c.env.DB);

  if (email) await userService.updateUser(user.id, { email });
  await profileService.updateProfile(user.id, { bio, avatar, website, location });

  return c.json({ success: true });
});

export { api as profileApi };