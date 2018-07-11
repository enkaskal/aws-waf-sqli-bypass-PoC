#!/bin/bash

echo "attempting to detect your WAN IP"
OperatorWANIP=`curl -s https://wtfismyip.com/text`

echo "Detected your WAN IP as: ${OperatorWANIP}"
echo ""
echo -n "Would you like to use this as the WAN IP address to whitelist HTTP requests from?; if so please type 'yes': "
read res
if [ 'yes' != ${res} ]; then
  echo -n "Please specify the WAN IP address to whitelist HTTPS request from (i.e. where are you attacking from?): "
  read OperatorWANIP
fi

aws cloudformation update-stack --stack-name WAFTsting --template-body file://${PWD}/cf/sqli-tsting.yml --parameters ParameterKey=OperatorWANIP,ParameterValue=${OperatorWANIP}
aws cloudformation wait stack-update-complete --stack-name WAFTsting
aws cloudformation describe-stack-resource --stack-name WAFTsting --logical-resource-id WAFTstingALB | grep PhysicalResourceId | awk '{print $2}' | tr -d ',' | xargs aws elbv2 describe-load-balancers --load-balancer-arns | grep DNSName | awk '{print $2}' | tr -d ',' | tr -d '"' > bypass/alb.url

echo "PoC environment available at `cat bypass/alb.url`/WebGoat"

