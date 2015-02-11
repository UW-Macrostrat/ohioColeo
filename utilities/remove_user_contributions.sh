#! /bin/bash
psql -U john -h localhost -p 5432 -v v1=10 -c "delete from neodb.opinions where determiner_id = :v1;delete from neodb.occurrences_collectors where collector_id = :v1;delete from neodb.occurrences_images where occurrence_id IN (SELECT id FROM neodb.occurrences WHERE enterer_id = :v1);delete from neodb.occurrences where enterer_id = :v1;" ohio_new

