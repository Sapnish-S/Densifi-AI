env                 = "prod"
region              = "us-ord"
obj_region          = "us-ord"
obj_endpoint        = "us-ord-10.linodeobjects.com"
node_count          = 3
node_autoscaler_min = 3
node_autoscaler_max = 5
# Hackathon sizing on the $300 credit. Full production: g6-dedicated-2 x 3 (HA).
db_type         = "g6-nanode-1"
db_cluster_size = 1
domain          = "" # set to the Student Pack domain when claimed
manage_domain   = true
soa_email       = "ops@densify.example"
app_record_name = "app"
api_record_name = "api"
app_origins     = ["https://densify-ai.vercel.app"]
deployment_mode = "vm"
