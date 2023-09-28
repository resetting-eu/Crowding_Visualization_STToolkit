import Head from 'next/head'

import { useState, useEffect, useMemo } from 'react';

import CircularProgress from '@mui/material/CircularProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import DeleteIcon from '@mui/icons-material/Delete';

import config from '@/components/Config';

const modalBoxStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
  textAlign: 'center',
};

export default function Account(props) {
  const [isAdmin, setIsAdmin] = useState(null);
  const [isRoot, setIsRoot] = useState(null);
  const [email, setEmail] = useState(null);
  const [tab, setTab] = useState("password");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [alert, setAlert] = useState(null);

  const [freeze, setFreeze] = useState(true);

  const [users, setUsers] = useState(null);

  const [userToDelete, setUserToDelete] = useState(null);
  const [userToChangeRole, setUserToChangeRole] = useState(null);
  const [emailToCreate, setEmailToCreate] = useState(null);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserAdmin, setNewUserAdmin] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const visibleUsers = useMemo(
    () => users ? users.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : [],
    [users, page, rowsPerPage]
  );

  function handleChangePage(_, newPage) {
    setPage(newPage);
  }

  function handleChangeRowsPerPage(e) {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  }

  useEffect(() => {
    fetch(config.urlPrefix + "/auth/user_info", {credentials: "include"})
      .then(r => {
        if(r.status === 200) {
          return r.json();
        } else {
          window.location.replace("/login");
        }
      })
      .then(res => {
        const is_admin = res.role === "admin" || res.role === "superuser";
        setIsAdmin(is_admin);
        setIsRoot(res.role === "superuser");
        setEmail(res.email);
        if(is_admin) {
          loadUsers();
        } else {
          setFreeze(false);
        }
      });
  }, []);

  function loadUsers() {
    setFreeze(true);
    fetch(config.urlPrefix + "/auth/user_list", {credentials: "include"})
      .then(r => {
        if(r.status === 200) {
          return r.json();
        } else {
          window.location.replace("/login");
        }})
      .then(res => {
        setUsers(res);
        setFreeze(false);
      });
  }

  function changePassword() {
    setFreeze(true);
    
    if(password.length < 6) {
      setAlert("Password must have at least 6 characters");
      setFreeze(false);
      return;
    } else if(password !== confirmPassword) {
      setAlert("Passwords do not match")
      setFreeze(false);
      return;
    }

    fetch(config.urlPrefix + "/auth/password", {method: "PUT", credentials: "include", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email, password})})
    .then(r => {
      if(r.status === 200) {
        window.location.replace("/login");
        setAlert(null);
      } else {
        setAlert("Unexpected error");
        setFreeze(false);
      }
    });
  }

  function signOut() {
    fetch(config.urlPrefix + "/auth/logout", {credentials: "include"})
      .then(() => window.location.replace("/login"));
  }

  function gotoApp() {
    window.location.replace("/");
  }

  function tabChange(value) {
    if(value === "signout") {
      setFreeze(true);
      signOut();
    } else if(value === "back") {
      setFreeze(true);
      gotoApp();
    } else {
      setTab(value);
    }
    setAlert(null);
  }

  function deleteUserConfirm() {
    fetch(config.urlPrefix + "/auth/user", {credentials: "include", method: "DELETE", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email: userToDelete.email})})
      .then(r => {
        if(r.status === 200) {
          return r.json();
        } else {
          setUserToDelete(null);
          setAlert("Could not delete user");          
        }
      })
      .then(() => {
        setUserToDelete(null);
        loadUsers();
      })
  }

  function changeRoleConfirm() {
    fetch(config.urlPrefix + "/auth/role", {credentials: "include", method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email: userToChangeRole.email, is_admin: !userToChangeRole.is_admin})})
    .then(r => {
      if(r.status === 200) {
        return r.json();
      } else {
        setUserToChangeRole(null);
        setAlert("Could not change user's role");
      }
    })
    .then(() => {
      setUserToChangeRole(null);
      loadUsers();
    })
  }

  function createUserConfirm() {
    fetch(config.urlPrefix + "/auth/user", {credentials: "include", method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email: emailToCreate, name: newUserName, is_admin: newUserAdmin})})
      .then(r => {
        if(r.status === 200) {
          return r.json();
        } else {
          setEmailToCreate(null);
          setNewUserEmail("");
          setNewUserName("");
          setNewUserAdmin(false);
          setAlert("Could not create user");
        }
      })
      .then(() => {
        setEmailToCreate(null);
        setNewUserEmail("");
        setNewUserName("");
        setNewUserAdmin(false);
        loadUsers();
      })
  }

  return (
    <>
      <Head>
        <title>Crowding Visualization</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <Modal open={freeze}>
          <Box sx={modalBoxStyle}>
            <CircularProgress />
          </Box>
        </Modal>
        {userToDelete &&
          <Modal open={userToDelete}>
            <Box sx={modalBoxStyle}>
              <Typography>Delete user {userToDelete.email}</Typography>
              <Stack>
                <Button variant="contained" onClick={deleteUserConfirm}>Confirm</Button>
                <Button variant="outlined" onClick={() => setUserToDelete(null)}>Cancel</Button>
              </Stack>
            </Box>
          </Modal>}
        {userToChangeRole &&
          <Modal open={userToChangeRole}>
            <Box sx={modalBoxStyle}>
              <Typography>Make {userToChangeRole.email} {userToChangeRole.is_admin ? "a regular user" : "an administrator"}</Typography>
              <Stack>
                <Button variant="contained" onClick={changeRoleConfirm}>Confirm</Button>
                <Button variant="outlined" onClick={() => setUserToChangeRole(null)}>Cancel</Button>
              </Stack>
            </Box>
          </Modal>}
          {emailToCreate &&
            <Modal open={emailToCreate}>
              <Box sx={modalBoxStyle}>
                <Typography>Create {newUserAdmin ? "administrator" : "regular"} account for {emailToCreate}</Typography>
                <Stack>
                  <Button variant="contained" onClick={createUserConfirm}>Confirm</Button>
                  <Button variant="outlined" onClick={() => setEmailToCreate(null)}>Cancel</Button>
                </Stack>
              </Box>
            </Modal>}
        <Tabs value={tab} onChange={(_, v) => tabChange(v)} sx={{marginBottom: 3}}>
          <Tab label="Change password" value="password" />
          {isAdmin ? <Tab label="Administration" value="administration" /> : null}
          <Tab label="Sign out" value="signout" />
          <Tab label="Back to app" value="back" />
        </Tabs>
        <div role="tabpanel" hidden={tab !== "password"}>
          <Stack spacing={2}>
            <TextField type="password" label="New password" value={password} onChange={e => setPassword(e.target.value)} />
            <TextField type="password" label="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            <Button disabled={freeze} variant="contained" onClick={changePassword}>Change password</Button>
          </Stack>
        </div>
        {isAdmin ? 
          <div role="tabpanel" hidden={tab !== "administration"}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Is admin</TableCell>
                    <TableCell>Delete</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleUsers?.map((user) => (
                    <TableRow key={user.email}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>
                        {user.role === "superuser" ?
                          "root" :
                          <Checkbox checked={user.role === "admin"} disabled={!isRoot} onChange={() => setUserToChangeRole(user)}/>}
                      </TableCell>
                      <TableCell><IconButton disabled={user.role === "superuser" || (user.role === "admin" && !isRoot)} onClick={() => setUserToDelete(user)}><DeleteIcon /></IconButton></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 20]}
              component="div"
              count={users ? users.length : 0}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage} />
            <Stack direction="row" spacing={2} sx={{marginTop: 3}}>
              <TextField sx={{flex: 1}} label="New user email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
              <TextField sx={{flex: 1}} label="New user name" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
              <FormGroup><FormControlLabel label="Administrator" onChange={e => setNewUserAdmin(e.target.checked)} checked={newUserAdmin} disabled={!isRoot} control={<Checkbox />}/></FormGroup>
              <Button variant="contained" onClick={() => setEmailToCreate(newUserEmail)}>Create user</Button>
            </Stack>
          </div>
          : null}
        {alert && <Alert severity="error" onClose={() => setAlert(null)}>{alert}</Alert>}
      </main>
    </>
  )
}
