"use client";
import { useUser } from "./UserProvider";

export default function UserSwitch() {
  const { user, users, switchUser } = useUser();
  return (
    <div className="row between">
      <div>
        <div className="tiny muted">Logging as</div>
        <b>{user?.id} · {user?.name}</b>
      </div>
      <select value={user?.id ?? ""} onChange={(e) => (e.target.value === "__new" ? (localStorage.removeItem("nxg_current_user"), location.reload()) : switchUser(e.target.value))}>
        {users.map((u) => <option key={u.id} value={u.id}>{u.id} · {u.name}</option>)}
        <option value="__new">+ Add / change participant</option>
      </select>
    </div>
  );
}
