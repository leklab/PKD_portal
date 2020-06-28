from elasticsearch import Elasticsearch
import gzip


def connect_elasticsearch():
    es = Elasticsearch([{'host': 'localhost', 'port': 9200}])

    '''
    if es.ping():
        print('Yay Connect')
    else:
        print('Awww it could not connect!')
	'''


    return es


def create_transcript_expression_index(es, index_name='transcript_expression'):
	settings = {
		"settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        },
		"mappings": {
			"_doc": {
				"properties": {
					"gene_id": { "type": "text"},
					"mouse_id": { "type": "text"},
					"read_count": {"type": "integer"}
				}
			}
		}
	}

	es.indices.create(index=index_name, body=settings)


def create_mouse_index(es, index_name='mouse_details'):
	settings = {
		"settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        },
		"mappings": {
			"_doc": {
				"properties": {
					"mouse_id": { "type": "text"},
					"age": {"type": "text"},
					"genotype": {"type": "text"},
					"phenotype": {"type": "text"},
				}
			}
		}
	}

	es.indices.create(index=index_name, body=settings)


def populate_mouse_data(file, es, index_name='mouse_details'):
	#mouse_file = gzip.open(file,'rt')
	mouse_file = open(file,'rt')
	header = mouse_file.readline().strip('\n').split('\t')

	for line in mouse_file:
		fields = line.strip('\n').split('\t')
		#print(fields[0])

		record = {
			"mouse_id": fields[0],
			"age": fields[2],
			"genotype": fields[1],
			"phenotype": fields[3]
		}

		print(record)
		es.index(index=index_name, doc_type='_doc', body=record)

		#break



def populate_transcript_data(file, es, index_name='transcript_expression'):
	expression_file = gzip.open(file,'rt')

	expression_file.readline()
	header = expression_file.readline().strip('\n').split('\t')

	mouse_id = []

	for i in range(6,len(header)):
		#print(header[i])
		sample_id = header[i].split('/')
		#print(sample_id[0])
		mouse_id.append(sample_id[0])

	'''
	for i in range(len(mouse_id)):
		print(mouse_id[i])
	'''

	for line in expression_file:
		fields = line.strip('\n').split('\t')
		#print(fields[0])

		for i in range(6,len(fields)):
			#print(fields[i])
			record = {
				"gene_id": fields[0],
				"mouse_id": mouse_id[i-6],
				"read_count": fields[i]
			}

			#print(record)
			es.index(index=index_name, doc_type='_doc', body=record)

		#break






if __name__ == '__main__':
	es = connect_elasticsearch()
	#create_transcript_expression_index(es)	
	#populate_transcript_data('full.ncbiRef.Gene.counts.txt.gz',es)
	
	create_mouse_index(es)
	populate_mouse_data('SampleInfo',es)


