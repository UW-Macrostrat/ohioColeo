pg_dump -C -h localhost -p 5439 -U john ohio_new | psql -h localhost -p 5432 -U john ohio_new
scp -r teststrata:/Users/jczaplewski/ohio/public/images public/images_new