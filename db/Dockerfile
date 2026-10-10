# densify-schema: runs db/apply-schema.sh against DATABASE_URL (Helm pre-upgrade Job).
FROM postgres:16
COPY apply-schema.sh /db/apply-schema.sh
COPY schema /db/schema
USER postgres
ENTRYPOINT ["sh", "/db/apply-schema.sh"]
