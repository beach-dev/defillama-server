#!/bin/bash

git submodule update --init --recursive --remote --merge

docker build -t defillama-exporter .

docker-compose up -d