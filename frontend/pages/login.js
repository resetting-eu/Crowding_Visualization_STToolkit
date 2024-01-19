import Head from 'next/head'

import { useState } from 'react';

import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

import config from '@/components/Config';

// redirect to app if session cookie exists already in browser
if(typeof window !== 'undefined')
  fetch(config.urlPrefix + "/auth/user_info", {credentials: "include"})
    .then(r => {
      if(r.status === 200) // session exists
        window.location.replace("/")
    });

export default function Login(props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [alert, setAlert] = useState(null);

  // TODO invoke on enter key down
  function login() {
    setDisabled(true);
    fetch(config.urlPrefix + "/auth/login", {method: "POST", credentials: "include", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email, password})})
      .then(r => {
        if(r.status === 200) {
          window.location.replace("/");
          setAlert(null);
        } else if(r.status === 401) {
          setAlert("Invalid email or password");
          setDisabled(false);
        } else if(r.status === 429) {
          setAlert("Too many invalid login attempts");
          // let the form stay disabled since user can't login anyway
        } else {
          setAlert("Unexpected error");
          setDisabled(false);
        }
      });
  }

  function forgotPassword() {
    window.location.replace("/forgot_password");
  }

  function onKeyDown(e) {
    if(e.key === "Enter") {
      login();
    }
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
        <Stack spacing={2}>
          <TextField label="Email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKeyDown} />
          <TextField type="password" label="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={onKeyDown} />
          <Button disabled={disabled} variant="contained" onClick={login}>Sign in</Button>
          <Button variant="outlined" onClick={forgotPassword}>Forgot password</Button>
        </Stack>
        {alert && <Alert severity="error" onClose={() => setAlert(null)}>{alert}</Alert>}
      </main>
    </>
  )
}
