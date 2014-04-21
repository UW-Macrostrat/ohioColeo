DELETE FROM neodb.occurrences_images WHERE id > 5;
DELETE FROM neodb.images WHERE id > 5;
DELETE FROM neodb.occurrences_environments WHERE occurrence_id > 20;
DELETE FROM neodb.occurrences_collectors WHERE occurrence_id > 52;
DELETE FROM neodb.opinions WHERE occurrence_id > 52;
DELETE FROM neodb.occurrences WHERE taxon_id > 757;
DELETE FROM neodb.taxa WHERE id > 757;