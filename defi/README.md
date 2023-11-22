# defillama exporter

## Build Docker
```bash
./build.sh
```

## Run dimension exporter
- Populate dimensions of given adapters in current timestamp

docker-compose exec defillama-exporter ts-node src/_nakji/runDimensionData.ts [adapterType]
adapterType: dexs | fees | protocols
```bash
docker-compose exec defillama-exporter ts-node src/_nakji/runDimensionData.ts dexs
```

- Backfill

docker-compose exec defillama-exporter ts-node src/_nakji/backfillDimensionData.ts [adapterType] [startDate] [endDate]
```bash
docker-compose exec defillama-exporter ts-node src/_nakji/backfillDimensionData.ts dexs 11/01/2022 11/22/2022
```
