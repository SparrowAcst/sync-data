#!/bin/sh
echo 'Start validation job for'  $1
cd /home/andrii-boldak/projects/jace/sync-data 
/home/andrii-boldak/.nvm/versions/node/v14.13.1/bin/node ./src/scripts/validate-data $1