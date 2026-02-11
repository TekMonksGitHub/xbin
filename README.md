# XBin
XBin - Enterprise Content Platform

Getting Started
===============
Step 1: Download the Monkshu server https://github.com/TekMonks/monkshu.git  
Step 2: Unzip this app on top of the previous download's root folder  
Step 3: Install these modules using `npm install <modulename>` - mustache, sqlite3, bcryptjs, archiver  
Step 4: Start frontend using `<monkshu>/frontend/server/server.sh`  
Step 5: Start backed using `<monkshu>/backed/server/server.sh`  
Step 6: Browse to `https://<your IP>/apps/xbin/index.html`  

Embedding Guide
===============
- Copy filemanager, and other components to front-end of the app
- Create a HTML to embed file manager and add its element there
- On the app backend - copy the entire xbin backend app to a folder inside it. Eg xbin.
- In your app's app.js require xbin/lib/xbin_init.js and call xbin_init.initSync there to initialize xbin
- Expose the Xbin APIs via backend's apiregistry.json

Optional Step
=============
Modify `/frontend/framework/conf/default_app.json` to "xbin" and then `https://<your IP>` should auto redirect.

Login
=====
Please register a new account to login.
