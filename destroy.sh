#!/bin/bash

aws cloudformation delete-stack --stack-name WAFTsting
aws cloudformation wait stack-delete-complete --stack-name WAFTsting
