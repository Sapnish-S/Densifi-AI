# densify-migrate: runs db/migrate.sh against DATABASE_URL (Helm pre-upgrade Job).
FROM postgres:16
COPY migrate.sh /db/migrate.sh
COPY migrations /db/migrations
USER postgres
ENTRYPOINT ["sh", "/db/migrate.sh"]
