# write-ight
A GitHub contributions style graph, in 3D, for recording writing metrics

This uses the awesome seen.js library to graph writing frequency and progress.

This set up requires:
 - [Node.js](https://nodejs.org/)
 - A local [Redis](http://redis.io/) server (make sure you can only access it from localhost, [because security](http://redis.io/topics/security))
 - node modules :
  -[Express](https://expressjs.com/)
  -[body-parser](https://github.com/expressjs/body-parser)
  -[Redis](http://redis.io/)
  -[swig](https://www.npmjs.com/package/swig)
 - A copy of [seen.js](http://seenjs.io/) at site/js/seen.min.js
 - A file called user.json containing the username and password like such :
  - {"user":"I_Wright_Alright?","password":"s0m3_c88l_p*$5w0r)"}
