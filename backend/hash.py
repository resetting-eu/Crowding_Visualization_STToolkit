import bcrypt

def gen_hash(pwd):
    pwd_salt = bcrypt.gensalt()
    pwd_hash = bcrypt.hashpw(pwd.encode(), pwd_salt).decode()
    return pwd_hash

def check_hash(pwd, pwd_hash):
    return bcrypt.checkpw(pwd.encode(), pwd_hash.encode())
