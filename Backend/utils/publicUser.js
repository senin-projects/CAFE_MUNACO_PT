// [WBS 5.1.1] Keep login/session responses limited to public staff details.
export const publicUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  username: user.username,
  role: user.role,
});
