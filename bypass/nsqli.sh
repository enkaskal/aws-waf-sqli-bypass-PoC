#!/bin/bash

docker run -it --rm --name puppeteer -v $PWD:/app alekzonder/puppeteer:0.13.0 node nsqli.js
