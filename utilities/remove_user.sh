#! /bin/bash
psql -U john -h localhost -p 5432 -c "delete from neodb.people_roles where person_id = $1; delete from neodb.opinions where determiner_id = $1; delete from neodb.people where id = $1;" ohio_new
